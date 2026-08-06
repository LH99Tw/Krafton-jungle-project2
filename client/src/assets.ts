const defaultAssetBaseUrl = 'https://tirnfqlznctbvwzfolmq.supabase.co/storage/v1/object/public/app-assets/v1'

export const assetBaseUrl = (import.meta.env.VITE_ASSET_BASE_URL || defaultAssetBaseUrl).replace(/\/$/, '')
export const assetUrl = (path: string) => `${assetBaseUrl}/${path.replace(/^\//, '')}`
