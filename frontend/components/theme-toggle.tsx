'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-[88px]" />

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5 ring-1 ring-border/40">
      <button
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-all ${
          theme === 'light'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Light mode"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-all ${
          theme === 'system'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="System default"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-all ${
          theme === 'dark'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Dark mode"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
