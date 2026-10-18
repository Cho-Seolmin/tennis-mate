import { z } from 'zod'
import { equipmentCategories } from '../../types/database.ts'

export const equipmentFormSchema = z.object({
  category: z.enum(equipmentCategories, { error: '종류를 선택해 주세요.' }),
  brand: z
    .string()
    .trim()
    .min(1, { error: '브랜드를 입력해 주세요.' })
    .max(50, { error: '브랜드는 50자까지 입력할 수 있습니다.' }),
  model: z
    .string()
    .trim()
    .min(1, { error: '모델을 입력해 주세요.' })
    .max(50, { error: '모델은 50자까지 입력할 수 있습니다.' }),
})

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>
