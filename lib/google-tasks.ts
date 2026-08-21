import "server-only"

import type {
  BtcCustomRequestPayment,
  BtcPaymentConfig,
  CustomRequestPayment,
} from "@/lib/custom-request"
import { requiredEnv } from "@/lib/server-config"

const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks"
const DEFAULT_TASK_LIST_TITLE = "Rental Japanese Guy"

type GoogleTask = {
  completed?: string
  deleted?: boolean
  due?: string
  id?: string
  notes?: string
  status?: "completed" | "needsAction"
  title?: string
}

type GoogleTaskList = {
  id?: string
  title?: string
}

type GoogleTaskListsResponse = {
  items?: GoogleTaskList[]
  nextPageToken?: string
}

type GoogleTasksResponse = {
  items?: GoogleTask[]
  nextPageToken?: string
}

type TokenCache = {
  accessToken: string
  cacheKey: string
  expiresAt: number
}

let tokenCache: TokenCache | undefined
let taskListIdCache: string | undefined

class GoogleTasksError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "GoogleTasksError"
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

async function importGooglePrivateKey() {
  const pem = requiredEnv("GOOGLE_PRIVATE_KEY").replaceAll("\\n", "\n")
  const encoded = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/gu, "")
  const binary = atob(encoded)
  const keyBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["sign"]
  )
}

async function getTasksAccessTokenFromRefreshToken(now: number) {
  const clientId = process.env.GOOGLE_TASKS_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_TASKS_OAUTH_CLIENT_SECRET?.trim()
  const refreshToken = process.env.GOOGLE_TASKS_REFRESH_TOKEN?.trim()
  if (!clientId || !clientSecret || !refreshToken) {
    return null
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  })

  if (!response.ok) {
    throw new GoogleTasksError("Google Tasks OAuth refresh failed.", response.status)
  }

  const result = (await response.json()) as {
    access_token: string
    expires_in?: number
  }
  return {
    accessToken: result.access_token,
    cacheKey: "oauth-refresh-token",
    expiresAt: now + (result.expires_in ?? 3_600),
  }
}

async function getTasksAccessTokenFromServiceAccount(now: number) {
  const subject = process.env.GOOGLE_TASKS_IMPERSONATED_USER_EMAIL?.trim()
  const header = textToBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = textToBase64Url(
    JSON.stringify({
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3_600,
      iat: now,
      iss: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      scope: TASKS_SCOPE,
      ...(subject ? { sub: subject } : {}),
    })
  )
  const unsignedToken = `${header}.${claims}`
  const key = await importGooglePrivateKey()
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  )
  const assertion = `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`

  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  })

  if (!response.ok) {
    throw new GoogleTasksError("Google Tasks service auth failed.", response.status)
  }

  const result = (await response.json()) as {
    access_token: string
    expires_in?: number
  }
  return {
    accessToken: result.access_token,
    cacheKey: `service-account:${subject ?? "self"}`,
    expiresAt: now + (result.expires_in ?? 3_600),
  }
}

async function getGoogleTasksAccessToken() {
  const now = Math.floor(Date.now() / 1_000)
  const oauthConfigured = Boolean(
    process.env.GOOGLE_TASKS_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_TASKS_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_TASKS_REFRESH_TOKEN?.trim()
  )
  const cacheKey = oauthConfigured
    ? "oauth-refresh-token"
    : `service-account:${process.env.GOOGLE_TASKS_IMPERSONATED_USER_EMAIL?.trim() ?? "self"}`

  if (
    tokenCache &&
    tokenCache.cacheKey === cacheKey &&
    tokenCache.expiresAt > now + 60
  ) {
    return tokenCache.accessToken
  }

  tokenCache =
    (await getTasksAccessTokenFromRefreshToken(now)) ??
    (await getTasksAccessTokenFromServiceAccount(now))
  return tokenCache.accessToken
}

function tasksUrl(path: string, parameters?: Record<string, string>) {
  const url = new URL(`https://tasks.googleapis.com/tasks/v1${path}`)
  for (const [key, value] of Object.entries(parameters ?? {})) {
    url.searchParams.set(key, value)
  }
  return url
}

async function tasksRequest<T>(
  url: URL,
  init: RequestInit = {},
  acceptedStatuses: number[] = []
): Promise<T | null> {
  const accessToken = await getGoogleTasksAccessToken()
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  })

  if (acceptedStatuses.includes(response.status)) {
    return null
  }

  if (!response.ok) {
    const detail = await response.text()
    console.error("Google Tasks request failed", response.status, detail.slice(0, 500))
    throw new GoogleTasksError("Google Tasks request failed.", response.status)
  }

  if (response.status === 204) {
    return null
  }
  return (await response.json()) as T
}

function configuredTaskListTitle() {
  return process.env.GOOGLE_TASKS_LIST_TITLE?.trim() || DEFAULT_TASK_LIST_TITLE
}

async function listTaskLists() {
  const lists: GoogleTaskList[] = []
  let pageToken: string | undefined

  do {
    const response = await tasksRequest<GoogleTaskListsResponse>(
      tasksUrl("/users/@me/lists", {
        maxResults: "100",
        ...(pageToken ? { pageToken } : {}),
      })
    )
    lists.push(...(response?.items ?? []))
    pageToken = response?.nextPageToken
  } while (pageToken)

  return lists
}

async function getTaskListId() {
  const configuredId = process.env.GOOGLE_TASKS_LIST_ID?.trim()
  if (configuredId) {
    return configuredId
  }
  if (taskListIdCache) {
    return taskListIdCache
  }

  const title = configuredTaskListTitle()
  const existing = (await listTaskLists()).find((list) => list.title === title)
  if (existing?.id) {
    taskListIdCache = existing.id
    return taskListIdCache
  }

  const created = await tasksRequest<GoogleTaskList>(
    tasksUrl("/users/@me/lists"),
    {
      body: JSON.stringify({ title }),
      method: "POST",
    }
  )
  if (!created?.id) {
    throw new GoogleTasksError("Google Tasks list could not be created.", 500)
  }
  taskListIdCache = created.id
  return taskListIdCache
}

function taskReferenceMarker(reference: string) {
  return `RJG reference: ${reference}`
}

function truncateTaskTitle(value: string) {
  return value.length > 1024 ? value.slice(0, 1024) : value
}

function isoDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function taskDueToday() {
  return `${isoDateOnly()}T00:00:00.000Z`
}

function btc(amount: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
    minimumFractionDigits: 0,
  }).format(amount)} BTC`
}

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`
}

function notesFromSections(sections: string[][]) {
  return sections.map((section) => section.join("\n")).join("\n\n").slice(0, 8192)
}

function contactLines(input: Pick<CustomRequestPayment, "socialHandle" | "socialPlatform">) {
  const contactLabel: Record<CustomRequestPayment["socialPlatform"], string> = {
    discord: "Discord",
    instagram: "Instagram",
    line: "LINE",
    none: "Email only",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    x: "X.com",
  }

  return input.socialPlatform === "none" || !input.socialHandle
    ? ["Messaging app: Email only"]
    : [`${contactLabel[input.socialPlatform]}: ${input.socialHandle}`]
}

async function listOpenCustomRequestTasks() {
  const taskListId = await getTaskListId()
  const tasks: GoogleTask[] = []
  let pageToken: string | undefined

  do {
    const response = await tasksRequest<GoogleTasksResponse>(
      tasksUrl(`/lists/${encodeURIComponent(taskListId)}/tasks`, {
        maxResults: "100",
        showCompleted: "false",
        showDeleted: "false",
        ...(pageToken ? { pageToken } : {}),
      })
    )
    tasks.push(...(response?.items ?? []))
    pageToken = response?.nextPageToken
  } while (pageToken)

  return { taskListId, tasks }
}

async function findCustomRequestTask(reference: string) {
  const { taskListId, tasks } = await listOpenCustomRequestTasks()
  const marker = taskReferenceMarker(reference)
  const task = tasks.find((candidate) => candidate.notes?.includes(marker))
  return { task, taskListId }
}

async function insertCustomRequestTask(input: {
  due?: string
  notes: string
  reference: string
  title: string
}) {
  const existing = await findCustomRequestTask(input.reference)
  if (existing.task?.id) {
    return existing.task
  }

  return tasksRequest<GoogleTask>(
    tasksUrl(`/lists/${encodeURIComponent(existing.taskListId)}/tasks`),
    {
      body: JSON.stringify({
        due: input.due ?? taskDueToday(),
        notes: input.notes,
        status: "needsAction",
        title: truncateTaskTitle(input.title),
      }),
      method: "POST",
    }
  )
}

export async function createBtcCustomRequestTask(input: {
  btc: BtcPaymentConfig
  request: BtcCustomRequestPayment
  requestReference: string
}) {
  const expiresAt = Math.floor(
    Date.now() / 1_000 + input.btc.pendingRequestTtlHours * 60 * 60
  )
  const notes = notesFromSections([
    [
      taskReferenceMarker(input.requestReference),
      "Payment method: BTC",
      "Status: pending",
      "This is not a confirmed booking. Confirm only after BTC payment is received.",
      `Agreed amount: ${btc(input.request.amountBtc)}`,
      `BTC network: ${input.btc.network}`,
      `BTC receiving address: ${input.btc.address}`,
      `Confirmations required: ${input.btc.confirmationsRequired}`,
      `Pending request expires at: ${new Date(expiresAt * 1_000).toISOString()}`,
      `RJG btcRequestExpiresAt: ${expiresAt}`,
      "RJG btcRequestStatus: pending",
    ],
    [
      `Customer: ${input.request.name}`,
      `Email: ${input.request.email}`,
      ...contactLines(input.request),
      `Request: ${input.request.requestTitle}`,
      ...(input.request.notes ? [`Notes: ${input.request.notes}`] : []),
    ],
    [
      "Customer instructions: pay the exact BTC amount and include/send this reference in messages.",
      "BTC positioning: for people who want to use Bitcoin as real-world peer-to-peer money; card remains the normal pricing path.",
      `Refund policy: ${input.btc.refundPolicy}`,
    ],
  ])

  await insertCustomRequestTask({
    notes,
    reference: input.requestReference,
    title: `BTC payment pending - ${input.request.requestTitle}`,
  })
}

export async function createStripeCustomRequestTask(input: {
  paidAt: number
  request: CustomRequestPayment
  requestReference: string
  sessionId: string
}) {
  const notes = notesFromSections([
    [
      taskReferenceMarker(input.requestReference),
      "Payment method: Stripe",
      "Status: paid",
      `Paid at: ${new Date(input.paidAt * 1_000).toISOString()}`,
      `Stripe session: ${input.sessionId}`,
      `Agreed amount: ${yen(input.request.amountJpy)}`,
      "RJG paymentStatus: paid",
    ],
    [
      `Customer: ${input.request.name}`,
      `Email: ${input.request.email}`,
      ...contactLines(input.request),
      `Request: ${input.request.requestTitle}`,
      ...(input.request.notes ? [`Notes: ${input.request.notes}`] : []),
    ],
    [
      "This is a paid custom request. It does not create a public booking slot or calendar event by itself.",
    ],
  ])

  await insertCustomRequestTask({
    notes,
    reference: input.requestReference,
    title: `Custom request paid - ${input.request.requestTitle}`,
  })
}

function parseBtcRequestStatus(notes?: string) {
  if (notes?.includes("RJG btcRequestStatus: success")) {
    return "success"
  }
  if (notes?.includes("RJG btcRequestStatus: paid_unconfirmed")) {
    return "paid_unconfirmed"
  }
  return "pending"
}

export async function deleteExpiredBtcCustomRequestTasks() {
  const now = Math.floor(Date.now() / 1_000)
  const { taskListId, tasks } = await listOpenCustomRequestTasks()
  const expired = tasks.filter((task) => {
    const expiresAt = Number(task.notes?.match(/RJG btcRequestExpiresAt: (\d+)/u)?.[1])
    return (
      task.id &&
      task.notes?.includes("Payment method: BTC") &&
      parseBtcRequestStatus(task.notes) === "pending" &&
      Number.isFinite(expiresAt) &&
      expiresAt <= now
    )
  })

  await Promise.all(
    expired.map((task) =>
      tasksRequest<null>(
        tasksUrl(
          `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(
            task.id ?? ""
          )}`
        ),
        { method: "DELETE" },
        [404, 410]
      )
    )
  )

  return { deleted: expired.length }
}

export async function findBtcCustomRequestPaymentTask(reference: string) {
  const { task } = await findCustomRequestTask(reference)
  const amountMatch = task?.notes?.match(/Agreed amount: ([0-9,.]+) BTC/u)
  const amountBtc = amountMatch ? Number(amountMatch[1].replaceAll(",", "")) : Number.NaN
  if (!task?.id || !Number.isFinite(amountBtc)) {
    return null
  }

  return {
    amountBtc,
    status: parseBtcRequestStatus(task.notes),
  }
}

export async function updateBtcCustomRequestPaymentTask(input: {
  confirmations: number
  paidAt: number
  reference: string
  status: "paid_unconfirmed" | "success"
  txid: string
}) {
  const { task, taskListId } = await findCustomRequestTask(input.reference)
  if (!task?.id) {
    return { updated: false as const }
  }

  if (parseBtcRequestStatus(task.notes) === "success") {
    return { alreadySuccess: true as const, updated: true as const }
  }

  const notes = [
    task.notes?.replace(/RJG btcRequestStatus: \w+/u, `RJG btcRequestStatus: ${input.status}`),
    "",
    `BTC transaction: ${input.txid}`,
    `BTC confirmations: ${input.confirmations}`,
    `BTC status: ${input.status}`,
    `BTC paid at: ${new Date(input.paidAt * 1_000).toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8192)

  await tasksRequest<GoogleTask>(
    tasksUrl(`/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(task.id)}`),
    {
      body: JSON.stringify({
        notes,
        title: truncateTaskTitle(
          input.status === "success"
            ? task.title?.replace("BTC payment pending", "BTC payment confirmed") ??
                `BTC payment confirmed - ${input.reference}`
            : task.title?.replace("BTC payment pending", "BTC payment seen") ??
                `BTC payment seen - ${input.reference}`
        ),
      }),
      method: "PATCH",
    }
  )

  return { updated: true as const }
}
