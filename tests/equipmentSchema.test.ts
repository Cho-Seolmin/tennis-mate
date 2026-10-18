import { describe, expect, it } from 'vitest'
import { equipmentFormSchema } from '../src/features/dashboard/equipmentSchema.ts'
import migrationSql from '../supabase/migrations/20261018010000_schedules_and_equipment.sql?raw'

describe('equipment schema', () => {
  it('trims valid equipment and rejects empty or unknown values', () => {
    expect(
      equipmentFormSchema.parse({
        category: 'racket',
        brand: ' Wilson ',
        model: ' Blade ',
      }),
    ).toEqual({
      category: 'racket',
      brand: 'Wilson',
      model: 'Blade',
    })

    expect(equipmentFormSchema.safeParse({ category: 'racket', brand: ' ', model: 'Blade' }).success).toBe(false)
    expect(equipmentFormSchema.safeParse({ category: 'ball', brand: 'Wilson', model: 'Blade' }).success).toBe(false)
    expect(
      equipmentFormSchema.safeParse({ category: 'shoes', brand: '가'.repeat(51), model: 'Gel' }).success,
    ).toBe(false)
  })
})

describe('schedule and equipment migration', () => {
  it('rejects bad rows in the database and limits changes to the owner', () => {
    expect(migrationSql).toContain('constraint schedules_title_length check (char_length(title) between 1 and 100)')
    expect(migrationSql).toContain('constraint schedules_time_order check (end_at > start_at)')
    expect(migrationSql).toContain('constraint schedules_location_length check')
    expect(migrationSql).toContain('char_length(location) between 1 and 200')
    expect(migrationSql).toContain('char_length(memo) between 1 and 500')
    expect(migrationSql).toContain("constraint equipment_category_value check (category in ('racket', 'shoes', 'other'))")
    expect(migrationSql).toContain('new.user_id := auth.uid()')
    expect(migrationSql).toContain('user_id = (select auth.uid())')
    expect(migrationSql).toContain('for delete')
  })
})
