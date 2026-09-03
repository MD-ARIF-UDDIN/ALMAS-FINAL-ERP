import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * TableLoading component renders a clean, animated loading indicator spanning across table columns.
 */
export function TableLoading({ colSpan = 8, message = 'Fetching records from database...' }) {
  return (
    <tr className="table-loading-row">
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'transparent' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
          <Loader2 className="loading-spinner" size={24} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>{message}</span>
        </div>
      </td>
    </tr>
  );
}

/**
 * LoadingBlock renders a centered spinner inside a card or container (e.g. POS catalog or widget).
 */
export function LoadingBlock({ message = 'Loading...', minHeight = '180px' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight, width: '100%', gap: '0.6rem', padding: '1.5rem' }}>
      <Loader2 className="loading-spinner" size={24} style={{ color: 'var(--primary)' }} />
      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>{message}</span>
    </div>
  );
}

export default TableLoading;
