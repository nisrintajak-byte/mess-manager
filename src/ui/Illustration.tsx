import type { ReactElement } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from './theme';

export type Art =
  'room' | 'expense' | 'settle' | 'welcome' | 'waiting' | 'inbox' | 'needs' | 'shield' | 'calendar';

/**
 * Flat pictures for the intro slides and empty screens (founder 2026-10-23), drawn in code with
 * the theme colours so they follow light/dark themes and cost nothing to download. Decorative:
 * the text next to them carries the meaning.
 */
export function Illustration({ art, size = 200 }: { art: Art; size?: number }) {
  return (
    <Svg
      width={size}
      height={size * 0.8}
      viewBox="0 0 200 160"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={100} cy={82} r={74} fill={colors.getBg} />
      <Circle cx={36} cy={30} r={6} fill={colors.accent} opacity={0.5} />
      <Circle cx={170} cy={128} r={8} fill={colors.payBg} />
      <Circle cx={172} cy={40} r={4} fill={colors.primary} opacity={0.3} />
      {ART[art]()}
    </Svg>
  );
}

/** a small person: head + shoulders */
function Person({ x, y, fill, s = 1 }: { x: number; y: number; fill: string; s?: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={9 * s} fill={fill} />
      <Path
        d={`M${x - 15 * s} ${y + 30 * s}a${15 * s} ${15 * s} 0 0 1 ${30 * s} 0z`}
        fill={fill}
        transform={`translate(0 ${-4 * s})`}
      />
    </G>
  );
}

function Coin({ x, y, r = 12 }: { x: number; y: number; r?: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={colors.accent} />
      <Circle
        cx={x}
        cy={y}
        r={r * 0.62}
        fill="none"
        stroke={colors.accentText}
        strokeWidth={1.5}
        opacity={0.35}
      />
    </G>
  );
}

const ART: Record<Art, () => ReactElement> = {
  // a Room (house) with its members, everything in the open
  room: () => (
    <G>
      <Path d="M52 78 100 40l48 38v58H52z" fill={colors.surface} stroke={colors.primary} strokeWidth={3} />
      <Path
        d="M44 82 100 36l56 46"
        fill="none"
        stroke={colors.primary}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Person x={78} y={96} fill={colors.primary} />
      <Person x={100} y={90} fill={colors.accent} s={1.1} />
      <Person x={122} y={96} fill={colors.success} />
      <Rect x={60} y={128} width={80} height={8} rx={4} fill={colors.getText} opacity={0.15} />
    </G>
  ),
  // a bill split into equal coins
  expense: () => (
    <G>
      <Path
        d="M62 30h52v92l-6.5-5-6.5 5-6.5-5-6.5 5-6.5-5-6.5 5-6.5-5-6.5 5z"
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Rect x={72} y={44} width={32} height={6} rx={3} fill={colors.primary} />
      <Rect x={72} y={58} width={24} height={5} rx={2.5} fill={colors.border} />
      <Rect x={72} y={70} width={28} height={5} rx={2.5} fill={colors.border} />
      <Rect x={72} y={86} width={32} height={8} rx={4} fill={colors.accent} />
      <Path
        d="M118 62h18M118 80h24M118 98h18"
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="2 6"
      />
      <Coin x={146} y={62} r={10} />
      <Coin x={154} y={80} r={10} />
      <Coin x={146} y={98} r={10} />
    </G>
  ),
  // all clear: big tick with coins
  settle: () => (
    <G>
      <Circle cx={100} cy={78} r={40} fill={colors.success} />
      <Path
        d="m82 79 12 12 24-26"
        fill="none"
        stroke={colors.surface}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Coin x={52} y={110} r={11} />
      <Coin x={66} y={124} r={11} />
      <Coin x={146} y={116} r={13} />
      <Path d="M140 34l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={colors.accent} />
      <Path d="M56 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={colors.primary} opacity={0.6} />
    </G>
  ),
  // first visit: a door opening into a Room
  welcome: () => (
    <G>
      <Rect
        x={58}
        y={36}
        width={60}
        height={96}
        rx={6}
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
      />
      <Path d="M118 36 84 46v96l34-10z" fill={colors.primary} />
      <Circle cx={92} cy={92} r={3} fill={colors.accent} />
      <Person x={138} y={94} fill={colors.accent} s={1.15} />
      <Path d="M150 52l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill={colors.accent} />
    </G>
  ),
  // waiting for the Admin: an hourglass
  waiting: () => (
    <G>
      <Rect x={70} y={34} width={60} height={8} rx={4} fill={colors.primary} />
      <Rect x={70} y={122} width={60} height={8} rx={4} fill={colors.primary} />
      <Path
        d="M78 42h44c0 22-16 28-16 40s16 18 16 40H78c0-22 16-28 16-40s-16-18-16-40z"
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
      />
      <Path d="M86 56h28c-3 9-14 14-14 22c0-8-11-13-14-22z" fill={colors.accent} />
      <Path d="M100 96c8 4 14 12 16 22H84c2-10 8-18 16-22z" fill={colors.accent} />
    </G>
  ),
  // nothing new: a calm bell
  inbox: () => (
    <G>
      <Path
        d="M72 104c6-6 6-14 6-28a22 22 0 0 1 44 0c0 14 0 22 6 28z"
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path d="M92 112a8 8 0 0 0 16 0" fill={colors.accent} />
      <Path
        d="M58 64a44 44 0 0 1 10-20M142 64a44 44 0 0 0-10-20"
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
        fill="none"
      />
      <Rect x={64} y={104} width={72} height={6} rx={3} fill={colors.primary} />
    </G>
  ),
  // a shopping bag for Room needs
  needs: () => (
    <G>
      <Path
        d="M66 58h68l-6 70H72z"
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="M84 66V52a16 16 0 0 1 32 0v14"
        fill="none"
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx={100} cy={96} r={14} fill={colors.accent} />
      <Path d="M100 89v14M93 96h14" stroke={colors.accentText} strokeWidth={3} strokeLinecap="round" />
    </G>
  ),
  // no disputes: a shield with a tick
  shield: () => (
    <G>
      <Path
        d="M100 132s40-18 40-50V48l-40-14-40 14v34c0 32 40 50 40 50z"
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="m84 82 11 11 22-22"
        fill="none"
        stroke={colors.success}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  ),
  // settlements arrive at the end of a period
  calendar: () => (
    <G>
      <Rect
        x={58}
        y={42}
        width={84}
        height={84}
        rx={10}
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
      />
      <Path d="M58 52a10 10 0 0 1 10-10h64a10 10 0 0 1 10 10v12H58z" fill={colors.primary} />
      <Path d="M78 34v16M122 34v16" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <Rect
            key={`${row}-${col}`}
            x={68 + col * 17}
            y={74 + row * 15}
            width={10}
            height={8}
            rx={2}
            fill={row === 2 && col === 3 ? colors.accent : colors.border}
          />
        )),
      )}
    </G>
  ),
};
