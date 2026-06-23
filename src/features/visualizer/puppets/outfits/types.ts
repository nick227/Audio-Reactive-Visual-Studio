export type OutfitPalette = {
  primary: string
  secondary: string
  accent: string
  trim: string
  shoe: string
}

export type OutfitDefinition = {
  id: string
  label: string
  tag: 'casual' | 'fancy' | 'stage' | 'none'
  bodyScale: number
  limbScale: number
  palette: OutfitPalette
}
