import { useState, useEffect } from "react";
import { motion } from "motion/react";

const TEAL = "#268D9A";
const TEAL_LIGHT = "#75C8CC";
const TEAL_DARK = "#176F7A";
const DARK = "#073940";
const EGG_FILL = "#FAF6F0";
const EGG_STROKE = "#E8DFD0";
const CRACK = "#C8BFAE";

export function HatchDino({ size = 160 }: { size?: number }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const hatched = phase === 2;

  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size * 1.1}
      style={{ overflow: "visible" }}
      role="img"
      aria-label="Hatch mascot hatching from an egg"
    >
      <defs>
        <linearGradient id="egg-grad" x1="0.3" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor="#FEFBF6" />
          <stop offset="100%" stopColor="#EDE4D5" />
        </linearGradient>
        <linearGradient id="body-grad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#2E9DAB" />
          <stop offset="100%" stopColor="#228490" />
        </linearGradient>
      </defs>

      {/* ===== DINO ===== */}
      <motion.g
        initial={{ opacity: 0, y: 30 }}
        animate={hatched ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={
          hatched
            ? { type: "spring", stiffness: 170, damping: 12, delay: 0.1 }
            : { duration: 0 }
        }
      >
        {/* Idle bob */}
        <motion.g
          animate={hatched ? { y: [0, -5, 0] } : { y: 0 }}
          transition={
            hatched
              ? { duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }
              : { duration: 0 }
          }
        >
          {/* Tail */}
          <motion.g
            animate={hatched ? { rotate: [0, 6, -4, 0] } : { rotate: 0 }}
            transition={
              hatched
                ? { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }
                : { duration: 0 }
            }
            style={{ transformOrigin: "138px 154px" }}
          >
            <path
              d="M138 154 Q158 150 162 134 Q166 118 152 110"
              stroke={TEAL}
              strokeWidth={9}
              fill="none"
              strokeLinecap="round"
            />
          </motion.g>

          {/* Left wing */}
          <motion.g
            animate={hatched ? { rotate: [0, -12, 0] } : { rotate: 0 }}
            transition={
              hatched
                ? { duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }
                : { duration: 0 }
            }
            style={{ transformOrigin: "60px 118px" }}
          >
            <ellipse cx={44} cy={128} rx={16} ry={22} fill={TEAL_DARK} />
          </motion.g>

          {/* Right wing */}
          <motion.g
            animate={hatched ? { rotate: [0, 12, 0] } : { rotate: 0 }}
            transition={
              hatched
                ? { duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }
                : { duration: 0 }
            }
            style={{ transformOrigin: "140px 118px" }}
          >
            <ellipse cx={156} cy={128} rx={16} ry={22} fill={TEAL_DARK} />
          </motion.g>

          {/* Body */}
          <rect x={62} y={96} width={76} height={76} rx={26} fill="url(#body-grad)" />

          {/* Head */}
          <ellipse cx={100} cy={76} rx={46} ry={40} fill="url(#body-grad)" />

          {/* Horns */}
          <path d="M70 44 L62 14 L82 40 Z" fill={TEAL_DARK} />
          <path d="M130 44 L138 14 L118 40 Z" fill={TEAL_DARK} />

          {/* Belly */}
          <ellipse cx={100} cy={136} rx={25} ry={30} fill={TEAL_LIGHT} />

          {/* Eyes with blink */}
          <motion.g
            animate={hatched ? { scaleY: [1, 1, 0.05, 1, 1] } : { scaleY: 1 }}
            transition={
              hatched
                ? {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.46, 0.5, 0.54, 1],
                    delay: 1.2,
                  }
                : { duration: 0 }
            }
            style={{ transformOrigin: "100px 70px" }}
          >
            <circle cx={82} cy={70} r={6.5} fill={DARK} />
            <circle cx={118} cy={70} r={6.5} fill={DARK} />
            <circle cx={84.5} cy={67.5} r={2.2} fill="white" />
            <circle cx={120.5} cy={67.5} r={2.2} fill="white" />
          </motion.g>

          {/* Mouth - cute w shape */}
          <path
            d="M91 88 Q95.5 94 100 89 Q104.5 94 109 88"
            stroke={DARK}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Feet */}
          <ellipse cx={80} cy={174} rx={15} ry={7} fill={TEAL_DARK} />
          <ellipse cx={120} cy={174} rx={15} ry={7} fill={TEAL_DARK} />
        </motion.g>
      </motion.g>

      {/* ===== EGG BOTTOM ===== */}
      <motion.g
        animate={hatched ? { y: 40, opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeIn" }}
      >
        <path
          d="M28 125 Q28 210 100 218 Q172 210 172 125 Z"
          fill="url(#egg-grad)"
          stroke={EGG_STROKE}
          strokeWidth={1.5}
        />
        {/* Speckles */}
        <circle cx={60} cy={160} r={2} fill={EGG_STROKE} opacity={0.5} />
        <circle cx={130} cy={175} r={1.5} fill={EGG_STROKE} opacity={0.4} />
        <circle cx={90} cy={190} r={1.8} fill={EGG_STROKE} opacity={0.35} />
        <circle cx={115} cy={145} r={1.5} fill={EGG_STROKE} opacity={0.4} />
      </motion.g>

      {/* ===== EGG TOP ===== */}
      <motion.g
        animate={
          hatched
            ? { y: -80, x: 30, rotate: 35, opacity: 0 }
            : phase === 1
              ? { rotate: [0, -3, 3, -3, 2, 0] }
              : { rotate: 0 }
        }
        transition={
          hatched
            ? { duration: 0.55, ease: [0.55, -0.05, 0.01, 0.95] }
            : phase === 1
              ? { duration: 0.5, repeat: 3, ease: "easeInOut" }
              : { duration: 0.3 }
        }
        style={{ transformOrigin: "100px 125px" }}
      >
        <path
          d="M28 125 Q28 22 100 8 Q172 22 172 125 Z"
          fill="url(#egg-grad)"
          stroke={EGG_STROKE}
          strokeWidth={1.5}
        />
        {/* Highlight */}
        <path
          d="M58 60 Q70 35 90 28"
          stroke="white"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          opacity={0.35}
        />
        {/* Speckles */}
        <circle cx={70} cy={80} r={2} fill={EGG_STROKE} opacity={0.5} />
        <circle cx={125} cy={55} r={1.5} fill={EGG_STROKE} opacity={0.4} />
        <circle cx={90} cy={40} r={1.8} fill={EGG_STROKE} opacity={0.35} />

        {/* Crack lines (appear in phase 1+) */}
        {phase >= 1 && (
          <motion.g
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1, pathLength: 1 }}
            transition={{ duration: 0.4 }}
          >
            <path
              d="M90 125 L94 100 L83 82 L92 60"
              stroke={CRACK}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M116 125 L111 94 L121 76"
              stroke={CRACK}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M102 125 L98 104 L106 86"
              stroke={CRACK}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          </motion.g>
        )}
      </motion.g>
    </svg>
  );
}
