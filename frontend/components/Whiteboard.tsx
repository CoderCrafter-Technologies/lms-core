// components/Whiteboard.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'
import { Button } from './ui/button'
import { 
  PencilIcon, 
  Square3Stack3DIcon, 
  CircleStackIcon, 
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  PaintBrushIcon
} from '@heroicons/react/24/outline'
import { Stage, Layer, Line, Rect, Circle, Text } from 'react-konva'

interface WhiteboardProps {
  socket: Socket | null
  roomId: string
  isInstructor: boolean
}

interface DrawingElement {
  id: string
  type: 'line' | 'rectangle' | 'circle' | 'text'
  points?: number[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  text?: string
  stroke: string
  strokeWidth: number
  fill?: string
}

interface DrawingState {
  tool: 'pen' | 'rectangle' | 'circle' | 'text' | 'eraser'
  stroke: string
  strokeWidth: number
  fill: string
}

const tools = [
  { id: 'pen', name: 'Pen', icon: PencilIcon },
  { id: 'rectangle', name: 'Rectangle', icon: Square3Stack3DIcon },
  { id: 'circle', name: 'Circle', icon: CircleStackIcon },
  { id: 'eraser', name: 'Eraser', icon: TrashIcon },
]

const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500']
const strokeWidths = [1, 2, 5, 10, 15]

export default function Whiteboard({ socket, roomId, isInstructor }: WhiteboardProps) {
  const stageRef = useRef<any>(null)
  const [elements, setElements] = useState<DrawingElement[]>([])
  const [history, setHistory] = useState<DrawingElement[][]>([])
  const [historyStep, setHistoryStep] = useState(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  
  const [drawingState, setDrawingState] = useState<DrawingState>({
    tool: 'pen',
    stroke: '#000000',
    strokeWidth: 2,
    fill: 'transparent'
  })

  // Set initial dimensions and handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (typeof window !== 'undefined') {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight - 200 // Adjust for toolbar height
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    
    return () => {
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  // Socket event handlers for real-time drawing
  useEffect(() => {
    if (!socket) return

    const handleDraw = (data: any) => {
      if (data.type === 'add-element') {
        setElements(prev => [...prev, data.element])
      } else if (data.type === 'update-element') {
        setElements(prev => 
          prev.map(el => el.id === data.element.id ? data.element : el)
        )
      }
    }

    const handleClear = () => {
      setElements([])
    }

    socket.on('whiteboard-draw', handleDraw)
    socket.on('whiteboard-clear', handleClear)

    return () => {
      socket.off('whiteboard-draw', handleDraw)
      socket.off('whiteboard-clear', handleClear)
    }
  }, [socket])

  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9)
  }

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push([...elements])
    setHistory(newHistory)
    setHistoryStep(newHistory.length - 1)
  }

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1)
      setElements([...history[historyStep - 1]])
    }
  }

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1)
      setElements([...history[historyStep + 1]])
    }
  }

  const clearCanvas = () => {
    if (!isInstructor) return
    
    setElements([])
    saveToHistory()
    
    if (socket) {
      socket.emit('whiteboard-clear', { roomId })
    }
  }

  const handleMouseDown = (e: any) => {
    if (!isInstructor && drawingState.tool !== 'pen') return
    
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    const id = generateId()
    
    setIsDrawing(true)

    let newElement: DrawingElement

    switch (drawingState.tool) {
      case 'pen':
        newElement = {
          id,
          type: 'line',
          points: [pos.x, pos.y],
          stroke: drawingState.stroke,
          strokeWidth: drawingState.strokeWidth
        }
        break
      case 'rectangle':
        newElement = {
          id,
          type: 'rectangle',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: drawingState.stroke,
          strokeWidth: drawingState.strokeWidth,
          fill: drawingState.fill
        }
        break
      case 'circle':
        newElement = {
          id,
          type: 'circle',
          x: pos.x,
          y: pos.y,
          radius: 0,
          stroke: drawingState.stroke,
          strokeWidth: drawingState.strokeWidth,
          fill: drawingState.fill
        }
        break
      default:
        return
    }

    setCurrentElement(newElement)
    setElements(prev => [...prev, newElement])

    if (socket) {
      socket.emit('whiteboard-draw', {
        roomId,
        type: 'add-element',
        element: newElement
      })
    }
  }

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !currentElement) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()
    
    let updatedElement = { ...currentElement }

    switch (currentElement.type) {
      case 'line':
        updatedElement.points = [...(currentElement.points || []), point.x, point.y]
        break
      case 'rectangle':
        updatedElement.width = point.x - (currentElement.x || 0)
        updatedElement.height = point.y - (currentElement.y || 0)
        break
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(point.x - (currentElement.x || 0), 2) + 
          Math.pow(point.y - (currentElement.y || 0), 2)
        )
        updatedElement.radius = radius
        break
    }

    setCurrentElement(updatedElement)
    setElements(prev => 
      prev.map(el => el.id === updatedElement.id ? updatedElement : el)
    )

    if (socket) {
      socket.emit('whiteboard-draw', {
        roomId,
        type: 'update-element',
        element: updatedElement
      })
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    setCurrentElement(null)
    saveToHistory()
  }

  const renderElement = (element: DrawingElement, index: number) => {
    switch (element.type) {
      case 'line':
        return (
          <Line
            key={element.id}
            points={element.points}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            tension={0.5}
            lineCap="round"
            globalCompositeOperation="source-over"
          />
        )
      case 'rectangle':
        return (
          <Rect
            key={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            fill={element.fill}
          />
        )
      case 'circle':
        return (
          <Circle
            key={element.id}
            x={element.x}
            y={element.y}
            radius={element.radius}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            fill={element.fill}
          />
        )
      case 'text':
        return (
          <Text
            key={element.id}
            x={element.x}
            y={element.y}
            text={element.text}
            fontSize={20}
            fill={element.stroke}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-100 p-3 border-b flex items-center gap-4 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={drawingState.tool === tool.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDrawingState(prev => ({ ...prev, tool: tool.id as any }))}
              disabled={!isInstructor && tool.id !== 'pen'}
              title={tool.name}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1">
          {colors.map((color) => (
            <button
              key={color}
              className={`w-6 h-6 rounded border-2 ${
                drawingState.stroke === color ? 'border-gray-800' : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setDrawingState(prev => ({ ...prev, stroke: color }))}
            />
          ))}
        </div>

        {/* Stroke Width */}
        <div className="flex items-center gap-2">
          <PaintBrushIcon className="h-4 w-4" />
          <select
            value={drawingState.strokeWidth}
            onChange={(e) => setDrawingState(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
            className="px-2 py-1 border rounded text-sm"
          >
            {strokeWidths.map((width) => (
              <option key={width} value={width}>{width}px</option>
            ))}
          </select>
        </div>

        {/* History controls */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={historyStep <= 0 || !isInstructor}
            title="Undo"
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={historyStep >= history.length - 1 || !isInstructor}
            title="Redo"
          >
            <ArrowUturnRightIcon className="h-4 w-4" />
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={clearCanvas}
            disabled={!isInstructor}
            title="Clear All"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
        >
          <Layer>
            {elements.map((element, index) => renderElement(element, index))}
          </Layer>
        </Stage>
      </div>

      {/* Instructions */}
      {!isInstructor && (
        <div className="bg-yellow-50 border-t border-yellow-200 p-2 text-sm text-yellow-800">
          <p className="text-center">
            📝 You can only use the pen tool. The instructor controls other drawing tools.
          </p>
        </div>
      )}
    </div>
  )
}