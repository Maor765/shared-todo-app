import { PublicUser } from '../../types';

export function Avatar({ member, size = 24 }: { member: PublicUser | null; size?: number }) {
  if (!member) return null;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: member.color,
        color: member.text_color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {member.initials}
    </div>
  );
}
