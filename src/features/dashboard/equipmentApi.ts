import { supabase } from '../../lib/supabase.ts'
import type { Equipment } from '../../types/database.ts'
import { equipmentRowError } from './dbError.ts'
import { equipmentFormSchema, type EquipmentFormValues } from './equipmentSchema.ts'

const equipmentColumns = 'id, user_id, category, brand, model, created_at' as const

export function parseEquipmentWrite(input: unknown): EquipmentFormValues {
  const parsed = equipmentFormSchema.safeParse(input)

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? '장비 값을 확인해 주세요.')
  }

  return parsed.data
}

export async function fetchEquipment(userId: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('equipment')
    .select(equipmentColumns)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(equipmentRowError(error, '장비를 불러오지 못했습니다.'))
  }

  return data ?? []
}

export async function createEquipment(userId: string, input: unknown) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const dto = parseEquipmentWrite(input)
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      user_id: userId,
      category: dto.category,
      brand: dto.brand,
      model: dto.model,
    })
    .select(equipmentColumns)
    .single()

  if (error) {
    throw new Error(equipmentRowError(error, '장비를 저장하지 못했습니다.'))
  }

  return data
}

export async function deleteEquipment(id: string, userId: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    throw new Error(equipmentRowError(error, '장비를 삭제하지 못했습니다.'))
  }

  if (!data || data.length === 0) {
    throw new Error('본인 장비만 삭제할 수 있습니다.')
  }
}

export type { Equipment }
