'use client';
import { MetricBlock, CalculationOperator, BlockResult, UnitType } from '@/types';
import { useEffect } from 'react';
import { formatValueByUnit, getUnitLabel, validateFormulaUnits, getAvailableResultUnitTypes } from '@/lib/unitTypes';
import { CustomSelect } from './CustomSelect';

type FormulaBuilderProps = {
  blocks: MetricBlock[];
  calculation?: {
    operator: CalculationOperator;
    leftOperand: string;
    rightOperand: string;
    resultUnitType?: UnitType;
  };
  onCalculationChange: (calculation: { operator: CalculationOperator; leftOperand: string; rightOperand: string; resultUnitType?: UnitType } | undefined) => void;
  finalValue?: number | null;
  blockResults?: BlockResult[];
  resultUnitType?: UnitType;
};

const operators: { value: CalculationOperator; label: string; symbol: string }[] = [
  { value: 'add', label: 'Add', symbol: '+' },
  { value: 'subtract', label: 'Subtract', symbol: '−' },
  { value: 'multiply', label: 'Multiply', symbol: '×' },
  { value: 'divide', label: 'Divide', symbol: '÷' },
];

export function FormulaBuilder({
  blocks,
  calculation,
  onCalculationChange,
  finalValue,
  blockResults,
  resultUnitType,
}: FormulaBuilderProps) {
  // If less than 2 blocks, show message
  if (blocks.length < 2) {
    return (
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px dashed var(--border-default)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Add at least 2 calculation blocks to create a formula
        </p>
      </div>
    );
  }
  
  // Auto-initialize calculation when blocks become available
  useEffect(() => {
    if (blocks.length >= 2 && !calculation) {
      onCalculationChange({
        operator: 'divide',
        leftOperand: blocks[0].id,
        rightOperand: blocks[1].id,
      });
    }
  }, [blocks.length, calculation, blocks, onCalculationChange]);
  
  const leftOperand = calculation?.leftOperand || blocks[0].id;
  const operator = calculation?.operator || 'divide';
  const rightOperand = calculation?.rightOperand || blocks[1].id;
  const selectedResultUnitType = calculation?.resultUnitType;
  
  // Get unit types from block results
  const leftBlockResult = blockResults?.find(b => b.blockId === leftOperand);
  const rightBlockResult = blockResults?.find(b => b.blockId === rightOperand);
  const leftUnitType = leftBlockResult?.unitType || 'count';
  const rightUnitType = rightBlockResult?.unitType || 'count';
  
  // Validate unit types
  const validation = validateFormulaUnits(operator, leftUnitType, rightUnitType);
  const availableResultTypes = getAvailableResultUnitTypes(operator, leftUnitType, rightUnitType);
  
  const handleLeftChange = (blockId: string) => {
    onCalculationChange({
      operator,
      leftOperand: blockId,
      rightOperand,
      resultUnitType: selectedResultUnitType,
    });
  };
  
  const handleOperatorChange = (newOperator: CalculationOperator) => {
    onCalculationChange({
      operator: newOperator,
      leftOperand,
      rightOperand,
      resultUnitType: selectedResultUnitType,
    });
  };
  
  const handleRightChange = (blockId: string) => {
    onCalculationChange({
      operator,
      leftOperand,
      rightOperand: blockId,
      resultUnitType: selectedResultUnitType,
    });
  };
  
  const handleResultUnitTypeChange = (unitType: UnitType) => {
    onCalculationChange({
      operator,
      leftOperand,
      rightOperand,
      resultUnitType: unitType,
    });
  };
  
  const handleClear = () => {
    onCalculationChange(undefined);
  };
  
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Formula
        </label>
      </div>
      
      <div className="flex flex-col gap-2 mb-3">
        {/* Left Operand */}
        <CustomSelect
          value={leftOperand}
          onChange={handleLeftChange}
          options={blocks.map((block) => ({
            value: block.id,
            label: block.name,
          }))}
          backgroundColor="var(--bg-primary)"
        />
        
        {/* Operator */}
        <CustomSelect
          value={operator}
          onChange={(value) => handleOperatorChange(value as CalculationOperator)}
          options={operators.map((op) => ({
            value: op.value,
            label: `${op.symbol} ${op.label}`,
          }))}
          backgroundColor="var(--bg-primary)"
        />
        
        {/* Right Operand */}
        <CustomSelect
          value={rightOperand}
          onChange={handleRightChange}
          options={blocks.map((block) => ({
            value: block.id,
            label: block.name,
          }))}
          backgroundColor="var(--bg-primary)"
        />
      </div>
      
      {/* Validation Error */}
      {!validation.valid && (
        <div
          className="flex items-start gap-2 p-3 rounded mb-3"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
            <path d="M8 1L15 14H1L8 1Z" stroke="#dc2626" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6V9" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.5" fill="#dc2626" />
          </svg>
          <div>
            <div className="text-xs font-medium" style={{ color: '#dc2626' }}>
              Invalid Formula
            </div>
            <div className="text-xs mt-1" style={{ color: '#991b1b' }}>
              {validation.error}
            </div>
          </div>
        </div>
      )}
      
      {/* Result Unit Type Selection (for mult/div) */}
      {validation.valid && (operator === 'multiply' || operator === 'divide') && availableResultTypes.length > 1 && (
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Result unit type
          </label>
          <CustomSelect
            value={selectedResultUnitType || availableResultTypes[0]}
            onChange={(value) => handleResultUnitTypeChange(value as UnitType)}
            options={availableResultTypes.map((type) => ({
              value: type,
              label: getUnitLabel(type),
            }))}
            backgroundColor="var(--bg-primary)"
          />
        </div>
      )}
      
      {/* Result Preview */}
      {validation.valid && finalValue !== undefined && finalValue !== null && resultUnitType && (
        <div
          className="flex items-center justify-between p-3 rounded"
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Result:
            </span>
            <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatValueByUnit(finalValue, resultUnitType)}
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {getUnitLabel(resultUnitType)}
          </span>
        </div>
      )}
    </div>
  );
}

