'use client'

import { Component, type ReactNode } from 'react'

interface SectionBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface SectionBoundaryState {
  failed: boolean
}

export class SectionBoundary extends Component<SectionBoundaryProps, SectionBoundaryState> {
  override state: SectionBoundaryState = { failed: false }

  static getDerivedStateFromError(): SectionBoundaryState {
    return { failed: true }
  }

  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
