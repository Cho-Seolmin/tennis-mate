import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useId, type SelectHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { useToast } from '../../hooks/useToast.ts'
import { equipmentCategories, type Equipment, type EquipmentCategory } from '../../types/database.ts'
import { createEquipment, deleteEquipment, fetchEquipment } from './equipmentApi.ts'
import { equipmentFormSchema, type EquipmentFormValues } from './equipmentSchema.ts'

const categoryLabels: Record<EquipmentCategory, string> = {
  racket: '라켓',
  shoes: '신발',
  other: '기타',
}

type EquipmentSectionProps = {
  userId: string
}

export function EquipmentSection({ userId }: EquipmentSectionProps) {
  const queryClient = useQueryClient()
  const { push } = useToast()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const equipmentQuery = useQuery({
    queryKey: ['equipment', userId],
    queryFn: () => fetchEquipment(userId),
  })
  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      category: 'racket',
      brand: '',
      model: '',
    },
  })
  const createMutation = useMutation({
    mutationFn: (values: EquipmentFormValues) => createEquipment(userId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['equipment', userId] })
      form.reset({ category: 'racket', brand: '', model: '' })
      push({ tone: 'success', message: '장비를 등록했습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '장비를 저장하지 못했습니다.',
      })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (item: Equipment) => deleteEquipment(item.id, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['equipment', userId] })
      setPendingDeleteId(null)
      push({ tone: 'success', message: '장비를 삭제했습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '장비를 삭제하지 못했습니다.',
      })
    },
  })

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">내 테니스 장비</h2>
      <form
        className="mt-4 space-y-3"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          const parsed = equipmentFormSchema.safeParse(values)

          if (!parsed.success) {
            return
          }

          createMutation.mutate(parsed.data)
        })}
      >
        <CategoryField
          error={form.formState.errors.category?.message}
          {...form.register('category')}
        />
        <Input
          label="브랜드"
          maxLength={50}
          error={form.formState.errors.brand?.message}
          {...form.register('brand')}
        />
        <Input
          label="모델"
          maxLength={50}
          error={form.formState.errors.model?.message}
          {...form.register('model')}
        />
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? '등록하는 중' : '장비 등록'}
        </Button>
      </form>
      <div className="mt-5">
        {equipmentQuery.isPending ? <Loading label="장비를 불러오는 중" /> : null}
        {equipmentQuery.isError ? (
          <ErrorMessage
            title="장비를 불러오지 못했습니다"
            message={
              equipmentQuery.error instanceof Error
                ? equipmentQuery.error.message
                : '다시 시도해 주세요.'
            }
            onRetry={() => {
              void equipmentQuery.refetch()
            }}
          />
        ) : null}
        {equipmentQuery.isSuccess && equipmentQuery.data.length === 0 ? (
          <EmptyState title="등록한 장비가 없습니다" description="라켓, 신발, 기타 장비를 추가해 보세요." />
        ) : null}
        {equipmentQuery.isSuccess && equipmentQuery.data.length > 0 ? (
          <ul className="space-y-3">
            {equipmentQuery.data.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-court-800">{categoryLabels[item.category]}</p>
                  <p className="break-words font-semibold text-ink">
                    {item.brand} {item.model}
                  </p>
                </div>
                {pendingDeleteId === item.id ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
                      취소
                    </Button>
                    <Button
                      aria-label={`${item.brand} ${item.model} 삭제 확인`}
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(item)}
                    >
                      {deleteMutation.isPending ? '삭제하는 중' : '삭제 확인'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    aria-label={`${item.brand} ${item.model} 삭제`}
                    onClick={() => setPendingDeleteId(item.id)}
                  >
                    삭제
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  )
}

type CategoryFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string
}

function CategoryField({ error, id, ...props }: CategoryFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = error ? `${inputId}-message` : undefined

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        종류
      </label>
      <select
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={[
          'min-h-11 w-full rounded-xl border bg-white px-3 text-base text-ink',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700',
          error ? 'border-danger' : 'border-line',
        ].join(' ')}
        {...props}
      >
        {equipmentCategories.map((category) => (
          <option key={category} value={category}>
            {categoryLabels[category]}
          </option>
        ))}
      </select>
      {error ? (
        <p id={messageId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
