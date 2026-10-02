import type { TriageVerdict } from './scoring';

export type BadgeState = TriageVerdict | 'pending';

export const BADGE_CLASS = 'tianming-badge';

const BADGE_STYLE: Record<BadgeState, { label: string; background: string; color: string }> = {
  pending: { label: '天命 · 评分中', background: '#e2e8f0', color: '#475569' },
  unscored: { label: '天命 · 未评分', background: '#e2e8f0', color: '#475569' },
  retry_later: { label: '天命 · 稍后重试', background: '#f1f5f9', color: '#64748b' },
  need_full_jd: { label: '天命 · 需看全文', background: '#fef3c7', color: '#92400e' },
  pass: { label: '天命 · 合适', background: '#dcfce7', color: '#166534' },
  maybe: { label: '天命 · 可看看', background: '#e0e7ff', color: '#3730a3' },
  reject: { label: '天命 · 不太合适', background: '#fee2e2', color: '#991b1b' },
};

export const badgeLabel = (state: BadgeState) => BADGE_STYLE[state].label;

/** 在卡片右上角放（或更新）一个徽章；同一张卡片只会有一个。 */
export const renderBadge = (card: HTMLElement, state: BadgeState, reason?: string) => {
  const doc = card.ownerDocument;
  let badge = card.querySelector<HTMLElement>(`:scope > .${BADGE_CLASS}`);
  if (!badge) {
    badge = doc.createElement('span');
    badge.className = BADGE_CLASS;
    Object.assign(badge.style, {
      position: 'absolute',
      top: '6px',
      right: '6px',
      zIndex: '2',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '600',
      lineHeight: '16px',
      pointerEvents: 'auto',
    });
    const view = doc.defaultView;
    if (view && view.getComputedStyle(card).position === 'static') {
      card.style.position = 'relative';
    }
    card.appendChild(badge);
  }
  const style = BADGE_STYLE[state];
  badge.textContent = style.label;
  badge.dataset.state = state;
  badge.title = reason ?? '';
  badge.style.background = style.background;
  badge.style.color = style.color;
  return badge;
};
