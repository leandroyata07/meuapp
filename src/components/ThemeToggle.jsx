import React, { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check current theme on mount
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  const toggleTheme = (e) => {
    e?.stopPropagation()
    const nextDark = !isDark
    setIsDark(nextDark)

    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`p-2.5 rounded-2xl glass-card border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 shadow-sm hover:shadow-md transition-all active:scale-90 group z-50 backdrop-blur-md ${className}`}
      title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
      aria-label="Alternar tema"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400 transition-transform group-hover:rotate-45 duration-300" />
        ) : (
          <Moon className="w-5 h-5 text-slate-700 transition-transform group-hover:-rotate-12 duration-300" />
        )}
      </div>
    </button>
  )
}
