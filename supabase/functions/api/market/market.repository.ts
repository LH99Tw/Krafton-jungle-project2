import { supabase } from '../shared.ts'

export const marketItemFields = 'id, seller_id, title, description, category, tags, condition, price_points, status, created_at, updated_at, deleted_at, purge_after'
export const marketItemDetailFields = `${marketItemFields}, like_count`

export const findMarketItem = (id: number) => supabase
  .from('market_item_details')
  .select(marketItemDetailFields)
  .eq('id', id)
  .maybeSingle()

export const findSeller = (id: number) => supabase
  .from('users')
  .select('id, nickname')
  .eq('id', id)
  .maybeSingle()
