import React from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    height: state.selectProps.isMulti ? 'auto' : '38px',
    borderRadius: '8px',
    borderColor: state.isFocused ? 'var(--primary, #2563eb)' : '#cbd5e1',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
    fontSize: '0.86rem',
    backgroundColor: state.isDisabled ? '#f8fafc' : '#ffffff',
    '&:hover': {
      borderColor: state.isFocused ? 'var(--primary, #2563eb)' : '#94a3b8',
    },
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 8px',
    fontSize: '0.86rem',
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontSize: '0.86rem',
    color: '#0f172a',
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: '0.84rem',
    color: '#94a3b8',
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: '0.86rem',
    color: '#0f172a',
    fontWeight: 500,
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    zIndex: 99999,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 99999,
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
    maxHeight: '220px',
  }),
  option: (base, state) => ({
    ...base,
    padding: '8px 12px',
    fontSize: '0.84rem',
    borderRadius: '6px',
    marginBottom: '2px',
    cursor: 'pointer',
    backgroundColor: state.isSelected
      ? 'var(--primary, #2563eb)'
      : state.isFocused
      ? '#eff6ff'
      : 'transparent',
    color: state.isSelected ? '#ffffff' : state.isFocused ? '#1d4ed8' : '#1e293b',
    fontWeight: state.isSelected ? 600 : 400,
    '&:active': {
      backgroundColor: 'var(--primary, #2563eb)',
      color: '#ffffff',
    },
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '4px 8px',
    color: '#64748b',
    '&:hover': {
      color: '#1e293b',
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: '4px 6px',
    color: '#94a3b8',
    '&:hover': {
      color: '#ef4444',
    },
  }),
};

export function SearchableSelect({ styles, ...props }) {
  const mergedStyles = {
    ...customSelectStyles,
    ...styles,
    control: (base, state) => ({
      ...customSelectStyles.control(base, state),
      ...(styles?.control ? styles.control(base, state) : {}),
    }),
  };

  return (
    <Select
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      menuPlacement="auto"
      styles={mergedStyles}
      {...props}
    />
  );
}

export function SearchableCreatableSelect({ styles, ...props }) {
  const mergedStyles = {
    ...customSelectStyles,
    ...styles,
    control: (base, state) => ({
      ...customSelectStyles.control(base, state),
      ...(styles?.control ? styles.control(base, state) : {}),
    }),
  };

  return (
    <CreatableSelect
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      menuPlacement="auto"
      styles={mergedStyles}
      {...props}
    />
  );
}

export default SearchableSelect;
