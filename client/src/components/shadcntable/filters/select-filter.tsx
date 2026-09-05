import { Select } from '@/components/ui/select'
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useDataTableLocale } from '../contexts/data-table-locale-context'
import type { FilterComponentProps } from '../types/filters'

export function SelectFilter({ value, onChange, config }: FilterComponentProps) {
  const locale = useDataTableLocale()

  return (
    <Select onValueChange={(val) => onChange(val)} value={value?.toString() ?? ''}>
      <SelectTrigger className='h-8 w-full'>
        <SelectValue placeholder={config.placeholder ?? locale.filters.select.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {config.options?.map((option) => (
          <SelectItem key={option.value} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
