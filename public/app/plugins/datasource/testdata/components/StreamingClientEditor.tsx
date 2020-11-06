import React, { ChangeEvent } from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { EditorProps } from '../QueryEditor';
import { StreamingQuery } from '../types';

const streamingClientFields = [
  { label: 'Update (ms)', id: 'update', placeholder: '250', min: 10, step: 10 },
  // { label: 'Spread', id: 'spread', placeholder: 'value', min: 0.5, step: 0.1 },
  // { label: 'Noise', id: 'noise', placeholder: 'value', min: 0, step: 0.1 },
  // { label: 'Bands', id: 'bands', placeholder: 'bands', min: 0, step: 1 },
];

const value_types = [
  { value: 'speed', label: 'Speed' },
  { value: 'rpm', label: 'Rpm' },
  { value: 'engaged_manual', label: 'Engaged' },
  { value: 'throttle', label: 'Throttle' },
  { value: 'latitude', label: 'Latitude' },
  { value: 'longitude', label: 'Longitude' },
  { value: 'wheel_position', label: 'wheel_position' },
  { value: 'coolant_temperature', label: 'coolant_temperature' },
  { value: 'oil_temperature', label: 'oil_temperature' },
  { value: 'oil_pressure', label: 'oil_pressure' },
  { value: 'altitude', label: 'altitude' },
];

const types = [{ value: 'mqtt', label: 'MQTT' }];

export const StreamingClientEditor = ({ onChange, query }: EditorProps) => {
  const onSelectChange = ({ value }: SelectableValue) => {
    onChange({ target: { name: 'type', value } });
  };

  const onSelectChangeField = ({ value }: SelectableValue) => {
    onChange({ target: { name: 'type_field', value } });
  };

  // Convert values to numbers before saving
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ target: { name, value: Number(value) } });
  };

  return (
    <InlineFieldRow>
      <InlineField label="Type" labelWidth={14}>
        <Select width={32} onChange={onSelectChange} defaultValue={types[0]} options={types} />
      </InlineField>

      <InlineField label="Field" labelWidth={14}>
        <Select width={32} onChange={onSelectChangeField} defaultValue={value_types[0]} options={value_types} />
      </InlineField>

      {(query?.stream?.type === 'signal' || query?.stream?.type === 'mqtt') &&
        streamingClientFields.map(({ label, id, min, step, placeholder }) => {
          return (
            <InlineField label={label} labelWidth={14} key={id}>
              <Input
                width={32}
                type="number"
                id={`stream.${id}-${query.refId}`}
                name={id}
                min={min}
                step={step}
                value={query.stream?.[id as keyof StreamingQuery]}
                placeholder={placeholder}
                onChange={onInputChange}
              />
            </InlineField>
          );
        })}

      {query?.stream?.type === 'fetch' && (
        <InlineField label="URL" labelWidth={14} grow>
          <Input
            type="text"
            name="url"
            id={`stream.url-${query.refId}`}
            value={query?.stream?.url}
            placeholder="Fetch URL"
            onChange={onChange}
          />
        </InlineField>
      )}
    </InlineFieldRow>
  );
};
