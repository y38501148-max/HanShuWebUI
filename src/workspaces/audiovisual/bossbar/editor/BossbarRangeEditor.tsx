import {
  BOSSBAR_BAR_DIRECTIONS,
  isDisplayRegion,
  type BossbarDocument,
  type BossbarNumericOperand,
  type BossbarRange,
  type BossbarVariable,
} from '../protocol'
import { NumberField, Row, SelectField, TextField } from './BossbarEditorUi'

export const BOSSBAR_DIRECTION_LABELS: Record<(typeof BOSSBAR_BAR_DIRECTIONS)[number], string> = {
  'left-to-right': '从左到右',
  'right-to-left': '从右到左',
  'bottom-to-top': '从下到上',
  'top-to-bottom': '从上到下',
}

function numericVariables(variables: Record<string, BossbarVariable>): { name: string; type: 'long' | 'double' }[] {
  return Object.entries(variables)
    .filter(([, variable]) => variable.type === 'long' || variable.type === 'double')
    .map(([name, variable]) => ({ name, type: variable.type as 'long' | 'double' }))
}

function operandTypeOf(
  operand: BossbarNumericOperand,
  variables: Record<string, BossbarVariable>,
): 'long' | 'double' | null {
  if ('var' in operand) {
    const variable = variables[operand.var]
    return variable && (variable.type === 'long' || variable.type === 'double') ? variable.type : null
  }
  return operand.type
}

function OperandEditor({
  operand,
  variables,
  onChange,
  readOnly,
}: {
  operand: BossbarNumericOperand
  variables: Record<string, BossbarVariable>
  onChange: (operand: BossbarNumericOperand) => void
  readOnly: boolean
}) {
  const options = numericVariables(variables)
  const mode = 'var' in operand ? 'var' : 'const'
  const type = operandTypeOf(operand, variables) ?? 'double'
  return (
    <span className="bb-operand">
      <SelectField
        disabled={readOnly}
        value={mode}
        options={[
          { value: 'const', label: '常量' },
          { value: 'var', label: '变量' },
        ]}
        onCommit={(next) => {
          if (next === mode) return
          if (next === 'var') {
            const first = options[0]
            if (!first) return
            onChange({ var: first.name })
            return
          }
          onChange(type === 'long' ? { type: 'long', value: '0' } : { type: 'double', value: 0 })
        }}
      />
      {mode === 'var' ? (
        <SelectField
          disabled={readOnly}
          value={(operand as { var: string }).var}
          options={
            options.length
              ? options.map((entry) => ({ value: entry.name, label: entry.name + '（' + entry.type + '）' }))
              : [{ value: (operand as { var: string }).var, label: '（没有 long/double 变量）' }]
          }
          onCommit={(next) => onChange({ var: next })}
        />
      ) : 'type' in operand && operand.type === 'long' ? (
        <TextField
          mono
          disabled={readOnly}
          value={operand.value}
          onCommit={(next) => {
            if (!/^-?[0-9]+$/.test(next.trim())) return
            onChange({ type: 'long', value: next.trim() })
          }}
        />
      ) : 'type' in operand ? (
        <NumberField
          disabled={readOnly}
          value={operand.value}
          onCommit={(next) => onChange({ type: 'double', value: next })}
        />
      ) : null}
    </span>
  )
}

/** 数值范围：三项必须同属 long 或 double */
export function BossbarRangeEditor({
  range,
  variables,
  onChange,
  readOnly,
  label = '数值范围',
}: {
  range: BossbarRange
  variables: Record<string, BossbarVariable>
  onChange: (range: BossbarRange) => void
  readOnly: boolean
  label?: string
}) {
  const types = (['value', 'min', 'max'] as const).map((field) => operandTypeOf(range[field], variables))
  const known = types.filter((type): type is 'long' | 'double' => type === 'long' || type === 'double')
  const mixed = new Set(known).size > 1
  return (
    <div className="bb-range">
      <Row label={label + ' · 当前值'}>
        <OperandEditor
          operand={range.value}
          variables={variables}
          readOnly={readOnly}
          onChange={(operand) => onChange({ ...range, value: operand })}
        />
      </Row>
      <Row label="最小值">
        <OperandEditor
          operand={range.min}
          variables={variables}
          readOnly={readOnly}
          onChange={(operand) => onChange({ ...range, min: operand })}
        />
      </Row>
      <Row label="最大值">
        <OperandEditor
          operand={range.max}
          variables={variables}
          readOnly={readOnly}
          onChange={(operand) => onChange({ ...range, max: operand })}
        />
      </Row>
      {mixed && (
        <p className="bb-warn">
          数值类型不一致（{known.join(' / ')}），请统一类型。
        </p>
      )}
    </div>
  )
}

export function regionBoxOf(document: BossbarDocument) {
  return document.components.find(isDisplayRegion)?.box ?? null
}
