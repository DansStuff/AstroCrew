import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { UiEntity, type UiTransformProps } from '@dcl/sdk/react-ecs'
import {
  UI_FONT,
  UI_TINT,
  boldUi,
  UI_GREEN_PIXEL_BUTTON_HOVER_FILL,
  UI_GREEN_PIXEL_BUTTON_HOVER_INSET,
  UI_GREEN_PIXEL_FRAME_FILL,
  UI_GREEN_PIXEL_FRAME_PATH,
  UI_GREEN_PIXEL_FRAME_SLICES
} from '../constants'

export const greenPixelFrameBackground = {
  color: UI_TINT,
  texture: { src: UI_GREEN_PIXEL_FRAME_PATH },
  textureMode: 'nine-slices' as const,
  textureSlices: UI_GREEN_PIXEL_FRAME_SLICES
}

export function GreenPixelFrame(props: {
  uiTransform: UiTransformProps
  children?: ReactEcs.JSX.Element | ReactEcs.JSX.Element[] | false | null
  onMouseDown?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  fillColor?: Color4
  uiText?: {
    value: string
    fontSize: number
    color?: Color4
    textAlign?: 'middle-center'
    font?: 'sans-serif' | 'serif' | 'monospace'
  }
}) {
  const inset = UI_GREEN_PIXEL_BUTTON_HOVER_INSET
  const clickable = !!(props.onMouseDown || props.onMouseEnter || props.onMouseLeave)

  return (
    <UiEntity uiTransform={props.uiTransform}>
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          positionType: 'absolute',
          position: { top: 0, left: 0 },
          padding: { top: inset, right: inset, bottom: inset, left: inset }
        }}
      >
        <UiEntity
          uiTransform={{ width: '100%', height: '100%' }}
          uiBackground={{ color: props.fillColor ?? UI_GREEN_PIXEL_FRAME_FILL }}
        />
      </UiEntity>
      {props.uiText ? (
        <UiEntity
          uiTransform={{
            width: '100%',
            height: '100%',
            positionType: 'absolute',
            position: { top: 0, left: 0 }
          }}          uiText={props.uiText}
        />
      ) : null}
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          positionType: 'absolute',
          position: { top: 0, left: 0 },
          pointerFilter: clickable ? 'block' : 'none'
        }}
        uiBackground={{
          ...greenPixelFrameBackground,
          textureMode: 'nine-slices'
        }}
        onMouseDown={props.onMouseDown}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      />
      {props.children}
    </UiEntity>
  )
}

let hoveredGreenPixelButton: string | null = null

export function GreenPixelButton(props: {
  value: string
  fontSize: number
  uiTransform: UiTransformProps
  onMouseDown: () => void
  color?: Color4
}) {
  const id = props.value
  const hovered = hoveredGreenPixelButton === id

  return (
    <GreenPixelFrame
      uiTransform={props.uiTransform}
      fillColor={hovered ? UI_GREEN_PIXEL_BUTTON_HOVER_FILL : UI_GREEN_PIXEL_FRAME_FILL}
      uiText={{
        value: boldUi(props.value),
        fontSize: props.fontSize,
        color: props.color ?? UI_TINT,
        textAlign: 'middle-center',
        font: UI_FONT
      }}
      onMouseDown={props.onMouseDown}
      onMouseEnter={() => {
        hoveredGreenPixelButton = id
      }}
      onMouseLeave={() => {
        if (hoveredGreenPixelButton === id) hoveredGreenPixelButton = null
      }}
    />
  )
}
