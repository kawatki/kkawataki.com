import "server-only"

import type { CustomRequestMessagingPlatform } from "@/lib/custom-request"
import {
  contactLines,
  notesFromSections,
  taskReferenceMarker,
  upsertGoogleTaskForReference,
} from "@/lib/google-tasks"

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`
}

export async function createStripeCommerceCheckoutTask(input: {
  amountJpy: number
  email: string
  itemIds: string
  itemKind: string
  itemLines: Array<{
    amountJpy: number
    itemId: string
    itemKind: string
    itemSummary: string
    requiresShipping: boolean
  }>
  itemSummary: string
  name: string
  notes: string
  paidAt: number
  preferredDate: string
  reference: string
  requiresShipping: boolean
  sessionId: string
  shippingAddress: {
    addressLine1: string
    addressLine2: string
    city: string
    country: string
    postalCode: string
    region: string
  } | null
  socialHandle: string
  socialPlatform: CustomRequestMessagingPlatform
}) {
  console.info("Creating Google Tasks to-do for paid commerce checkout", {
    reference: input.reference,
    sessionId: input.sessionId,
  })

  const itemLines =
    input.itemLines.length > 0
      ? input.itemLines
      : [
          {
            amountJpy: input.amountJpy,
            itemId: input.itemIds,
            itemKind: input.itemKind,
            itemSummary: input.itemSummary,
            requiresShipping: input.requiresShipping,
          },
        ]
  const packageLines = itemLines.filter((line) => line.itemKind === "package")
  const shopLines = itemLines.filter((line) => line.itemKind !== "package")
  const taskGroups = [
    packageLines.length > 0
      ? {
          amountJpy: packageLines.reduce((total, line) => total + line.amountJpy, 0),
          itemIds: packageLines.map((line) => line.itemId).join(","),
          itemKind: "package",
          itemSummary: packageLines.map((line) => line.itemSummary).join(" | "),
          referenceSuffix: "PKG",
          requiresShipping: false,
          titlePrefix: "Package paid",
        }
      : null,
    shopLines.length > 0
      ? {
          amountJpy: shopLines.reduce((total, line) => total + line.amountJpy, 0),
          itemIds: shopLines.map((line) => line.itemId).join(","),
          itemKind: "merch",
          itemSummary: shopLines.map((line) => line.itemSummary).join(" | "),
          referenceSuffix: "SHOP",
          requiresShipping: shopLines.some((line) => line.requiresShipping),
          titlePrefix: "Shop items paid",
        }
      : null,
  ].filter((group): group is NonNullable<typeof group> => Boolean(group))

  await Promise.all(
    taskGroups.map((group) => {
      const reference =
        taskGroups.length === 1
          ? input.reference
          : `${input.reference}-${group.referenceSuffix}`
      const notes = notesFromSections([
        [
          taskReferenceMarker(reference),
          `Parent checkout reference: ${input.reference}`,
          "Payment method: Stripe",
          "Status: paid",
          `Paid at: ${new Date(input.paidAt * 1_000).toISOString()}`,
          `Stripe session: ${input.sessionId}`,
          `Chunk amount: ${yen(group.amountJpy)}`,
          `Order total: ${yen(input.amountJpy)}`,
          `Item kind: ${group.itemKind}`,
          `Item IDs: ${group.itemIds}`,
          "RJG paymentStatus: paid",
        ],
        [
          `Customer: ${input.name}`,
          `Email: ${input.email}`,
          ...contactLines(input),
          ...(input.preferredDate && group.itemKind === "package"
            ? [`Preferred date: ${input.preferredDate}`]
            : []),
          `Items: ${group.itemSummary}`,
          ...(input.notes ? [`Order notes: ${input.notes}`] : []),
        ],
        group.requiresShipping && input.shippingAddress
          ? [
              "Shipping address:",
              input.shippingAddress.addressLine1,
              ...(input.shippingAddress.addressLine2
                ? [input.shippingAddress.addressLine2]
                : []),
              `${input.shippingAddress.city}, ${input.shippingAddress.region} ${input.shippingAddress.postalCode}`,
              input.shippingAddress.country,
            ]
          : ["Shipping: not required"],
        [
          group.itemKind === "package"
            ? "Package task: message the customer to arrange date and details. No calendar event or date hold was created."
            : "Shop task: fulfill or ship these items together after payment.",
        ],
      ])

      return upsertGoogleTaskForReference({
        notes,
        reference,
        title: `${group.titlePrefix} - ${group.itemSummary}`,
      })
    })
  )

  console.info("Created Google Tasks to-do for paid commerce checkout", {
    reference: input.reference,
    sessionId: input.sessionId,
  })
}
