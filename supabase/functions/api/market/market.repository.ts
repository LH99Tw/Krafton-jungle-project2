import { supabase } from '../shared.ts'

export const marketItemFields = 'id, seller_id, title, description, category, condition, price_points, status, created_at, updated_at'

export const findMarketItem = (id: number) => supabase
  .from('market_items')
  .select(marketItemFields)
  .eq('id', id)
  .maybeSingle()

export const findSeller = (id: number) => supabase
  .from('users')
  .select('id, nickname')
  .eq('id', id)
  .maybeSingle()
