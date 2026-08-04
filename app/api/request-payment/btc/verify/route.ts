import { getBtcPaymentConfig } from "@/lib/custom-request"
import {
  findBtcCustomRequestPayment,
  updateBtcCustomRequestPayment,
} from "@/lib/google-calendar"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"
import { ConfigurationError } from "@/lib/server-config"
import {
  TurnstileVerificationError,
  verifyTurnstile,
} from "@/lib/turnstile"

type EsploraTransaction = {
  status?: {
    block_height?: number
    block_time?: number
    confirmed?: boolean
  }
  vout?: Array<{
    scriptpubkey_address?: string
    value?: number
  }>
}

function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) {
    return false
  }
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

function btcToSats(amount: number) {
  return Math.round(amount * 100_000_000)
}

function explorerUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/u, "")}${path}`
}

async function getJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`BTC explorer returned ${response.status}.`)
  }
  return (await response.json()) as T
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "btc-tx-verify",
    limit: 30,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Invalid verification request." }, { status: 403 })
  }

  try {
    const input = await request.json()
    const turnstileToken =
      input && typeof input === "object" && "turnstileToken" in input
        ? input.turnstileToken
        : undefined
    await verifyTurnstile(turnstileToken, request)

    const reference =
      input && typeof input === "object" && "reference" in input
        ? String(input.reference ?? "").trim().toUpperCase()
        : ""
    const txid =
      input && typeof input === "object" && "txid" in input
        ? String(input.txid ?? "").trim().toLowerCase()
        : ""

    if (!/^RJG-REQ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/u.test(reference)) {
      throw new Error("Enter a valid payment reference.")
    }
    if (!/^[a-f0-9]{64}$/u.test(txid)) {
      throw new Error("Enter a valid Bitcoin transaction ID.")
    }

    const btc = getBtcPaymentConfig()
    if (!btc.address) {
      throw new ConfigurationError("BTC_RECEIVING_ADDRESS")
    }
    const pendingRequest = await findBtcCustomRequestPayment(reference)
    if (!pendingRequest) {
      return Response.json(
        { error: "Pending BTC request was not found." },
        { status: 404 }
      )
    }

    const transaction = await getJson<EsploraTransaction>(
      explorerUrl(btc.explorerApiUrl, `/tx/${txid}`)
    )
    if (!transaction) {
      return Response.json(
        { error: "Transaction was not found on the Bitcoin network yet." },
        { status: 404 }
      )
    }

    const receivedSats = (transaction.vout ?? [])
      .filter((output) => output.scriptpubkey_address === btc.address)
      .reduce((total, output) => total + (output.value ?? 0), 0)
    const expectedSats = btcToSats(pendingRequest.amountBtc)
    if (receivedSats < expectedSats) {
      return Response.json(
        {
          error: `This transaction sends less than ${pendingRequest.amountBtc} BTC to the receiving address.`,
          receivedSats,
          requiredSats: expectedSats,
        },
        { status: 400 }
      )
    }

    const confirmationsRequired = Number(btc.confirmationsRequired)
    const requiredConfirmations =
      Number.isInteger(confirmationsRequired) && confirmationsRequired > 0
        ? confirmationsRequired
        : 1
    const tipHeight = await getJson<number>(
      explorerUrl(btc.explorerApiUrl, "/blocks/tip/height")
    )
    const blockHeight = transaction.status?.block_height
    const confirmations =
      transaction.status?.confirmed && blockHeight && tipHeight
        ? Math.max(0, tipHeight - blockHeight + 1)
        : 0
    const status =
      confirmations >= requiredConfirmations ? "success" : "paid_unconfirmed"

    await updateBtcCustomRequestPayment({
      confirmations,
      paidAt:
        transaction.status?.block_time ??
        Math.floor(Date.now() / 1_000),
      reference,
      status,
      txid,
    })

    return Response.json({
      confirmations,
      confirmationsRequired: requiredConfirmations,
      receivedSats,
      requiredSats: expectedSats,
      status,
      txid,
    })
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message)
      return Response.json(
        { error: "BTC verification is being configured." },
        { status: 503 }
      )
    }
    if (error instanceof TurnstileVerificationError) {
      return Response.json(
        { error: error.message },
        { status: error.unavailable ? 503 : 400 }
      )
    }
    if (error instanceof Error && error.message.startsWith("Enter")) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    console.error("BTC transaction verification failed", error)
    return Response.json(
      { error: "BTC transaction could not be verified." },
      { status: 500 }
    )
  }
}
