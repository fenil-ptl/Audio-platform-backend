export const PLAN_LIMITS: Record<
    string,
    {
        tracksPerMonth: number // -1 = unlimited
        totalTracks: number // -1 = unlimited
        maxFileSizeMb: number
        allowedFormats: string[]
        commissionPercent: number
        hasAnalytics: boolean
        hasRevenuedashboard: boolean
        hasCustomLicense: boolean
        hasApiAccess: boolean
        approvalPriority: number // lower = higher priority
    }
> = {
    // price IDs from your Stripe Dashboard
    price_personal: {
        tracksPerMonth: 5,
        totalTracks: 10,
        maxFileSizeMb: 20,
        allowedFormats: ['mp3'],
        commissionPercent: 30,
        hasAnalytics: false,
        hasRevenuedashboard: false,
        hasCustomLicense: false,
        hasApiAccess: false,
        approvalPriority: 4,
    },
    price_professional: {
        tracksPerMonth: 20,
        totalTracks: 50,
        maxFileSizeMb: 50,
        allowedFormats: ['mp3', 'm4a'],
        commissionPercent: 20,
        hasAnalytics: true,
        hasRevenuedashboard: false,
        hasCustomLicense: false,
        hasApiAccess: false,
        approvalPriority: 3,
    },
    price_startup: {
        tracksPerMonth: 60,
        totalTracks: 200,
        maxFileSizeMb: 100,
        allowedFormats: ['mp3', 'm4a', 'wav'],
        commissionPercent: 10,
        hasAnalytics: true,
        hasRevenuedashboard: true,
        hasCustomLicense: true,
        hasApiAccess: true,
        approvalPriority: 2,
    },
    price_business: {
        tracksPerMonth: -1,
        totalTracks: -1,
        maxFileSizeMb: 200,
        allowedFormats: ['mp3', 'm4a', 'wav', 'flac', 'aiff'],
        commissionPercent: 5,
        hasAnalytics: true,
        hasRevenuedashboard: true,
        hasCustomLicense: true,
        hasApiAccess: true,
        approvalPriority: 1,
    },
    price_lifetime: {
        tracksPerMonth: -1,
        totalTracks: -1,
        maxFileSizeMb: 200,
        allowedFormats: ['mp3', 'm4a', 'wav', 'flac', 'aiff'],
        commissionPercent: 0,
        hasAnalytics: true,
        hasRevenuedashboard: true,
        hasCustomLicense: true,
        hasApiAccess: true,
        approvalPriority: 1,
    },
}

export function getPlanLimits(priceId: string | null) {
    if (!priceId) return null
    // Direct match first
    if (PLAN_LIMITS[priceId]) return PLAN_LIMITS[priceId]

    // Map environment price IDs to plan keys so we can store real Stripe price IDs
    const priceMap: Record<string, string> = {}

    const envMap: Array<[string | undefined, string]> = [
        [process.env.PRICE_PERSONAL, 'price_personal'],
        [process.env.PRICE_PROFESSIONAL, 'price_professional'],
        [process.env.PRICE_STARTUP, 'price_startup'],
        [process.env.PRICE_BUSINESS, 'price_business'],
        [process.env.PRICE_LIFETIME, 'price_lifetime'],
    ]

    for (const [envPrice, key] of envMap) {
        if (envPrice) {
            priceMap[envPrice] = key
        }
    }

    const mappedKey = priceMap[priceId]
    if (mappedKey && PLAN_LIMITS[mappedKey]) {
        return PLAN_LIMITS[mappedKey]
    }

    return null
}
