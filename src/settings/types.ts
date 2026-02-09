export type SettingsTab =
  | 'appearance'
  | 'toolbar'
  | 'feature-panel'
  | 'annotation'
  | 'whiteboard'
  | 'lanstart-bar'
  | 'about'

export interface SettingsTabItem {
  id: SettingsTab
  label: string
  icon: React.ReactNode
}
