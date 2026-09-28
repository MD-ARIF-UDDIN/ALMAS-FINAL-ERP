import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({
  currentPage,
  page,
  totalCount = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) {
  const current = page ?? currentPage ?? 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalCount);

  if (totalCount === 0) {
    return null;
  }

  // Calculate page numbers to display with smart ellipsis
  const getPageNumbers = () => {
    const delta = 1;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, current - delta);
      i <= Math.min(totalPages - 1, current + delta);
      i++
    ) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    // Deduplicate array while preserving order
    return [...new Set(rangeWithDots)];
  };

  return (
    <div className="pagination-bar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.75rem',
      padding: '0.85rem 1.25rem',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-color)',
      fontSize: '0.82rem',
      color: 'var(--text-secondary)'
    }}>
      {/* Left Info & Page Size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{from}</strong> to{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{to}</strong> of{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> entries
        </div>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="input-control"
              style={{
                width: 'auto',
                padding: '0.2rem 0.5rem',
                fontSize: '0.8rem',
                height: '30px',
                borderRadius: '4px'
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Page Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {/* First Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm pagination-btn"
          disabled={current <= 1}
          onClick={() => onPageChange(1)}
          title="First Page"
          style={{ padding: '0.35rem 0.5rem', opacity: current <= 1 ? 0.45 : 1 }}
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Prev Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm pagination-btn"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          title="Previous Page"
          style={{ padding: '0.35rem 0.5rem', opacity: current <= 1 ? 0.45 : 1 }}
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page Number Buttons */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} style={{ padding: '0 0.35rem', color: 'var(--text-muted)' }}>
                •••
              </span>
            );
          }

          const isActive = p === current;
          return (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'} pagination-btn`}
              onClick={() => onPageChange(p)}
              style={{
                minWidth: '32px',
                padding: '0.3rem 0.5rem',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Next Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm pagination-btn"
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          title="Next Page"
          style={{ padding: '0.35rem 0.5rem', opacity: current >= totalPages ? 0.45 : 1 }}
        >
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm pagination-btn"
          disabled={current >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last Page"
          style={{ padding: '0.35rem 0.5rem', opacity: current >= totalPages ? 0.45 : 1 }}
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}
