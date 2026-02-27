'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';

// Dynamically import Konva components to avoid SSR issues
const Stage = dynamic(() => import('react-konva').then((mod) => mod.Stage), { ssr: false });
const Layer = dynamic(() => import('react-konva').then((mod) => mod.Layer), { ssr: false });
const Line = dynamic(() => import('react-konva').then((mod) => mod.Line), { ssr: false });
const Circle = dynamic(() => import('react-konva').then((mod) => mod.Circle), { ssr: false });
const Rect = dynamic(() => import('react-konva').then((mod) => mod.Rect), { ssr: false });
const Text = dynamic(() => import('react-konva').then((mod) => mod.Text), { ssr: false });
const Arrow = dynamic(() => import('react-konva').then((mod) => mod.Arrow), { ssr: false });
import {
  PencilIcon,
  Square3Stack3DIcon,
  CircleStackIcon,
  ArrowUpIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  PaintBucketIcon
} from '@heroicons/react/24/outline';

interface WhiteboardProps {
  roomId: string;
}

interface DrawingData {
  id: string;
  tool: 'pen' | 'rect' | 'circle' | 'arrow' | 'text';
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  text?: string;
  timestamp: number;
}

const COLORS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 10];

export default function Whiteboard({ roomId }: WhiteboardProps) {
  const stageRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const [drawings, setDrawings] = useState<DrawingData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Tool state
  const [tool, setTool] = useState<'pen' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser'>('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState('transparent');
  
  // History for undo/redo
  const [history, setHistory] = useState<DrawingData[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  useEffect(() => {
    // Initialize socket connection for whiteboard
    socketRef.current = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      transports: ['websocket']
    });

    const socket = socketRef.current;

    socket.emit('join-whiteboard', roomId);

    socket.on('whiteboard-drawing', (drawingData: DrawingData) => {
      setDrawings(prev => [...prev, drawingData]);
    });

    socket.on('whiteboard-clear', () => {
      setDrawings([]);
    });

    socket.on('whiteboard-undo', (newDrawings: DrawingData[]) => {
      setDrawings(newDrawings);
    });

    socket.on('whiteboard-history', (history: DrawingData[]) => {
      setDrawings(history);
    });

    // Set loading to false once connected
    socket.on('connect', () => {
      setIsLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const saveToHistory = useCallback((newDrawings: DrawingData[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([...newDrawings]);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep]);

  const handleMouseDown = (e: any) => {
    if (tool === 'eraser') return;
    
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    
    if (tool === 'pen') {
      setCurrentPath([pos.x, pos.y]);
    } else if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const drawingData: DrawingData = {
          id: `text_${Date.now()}`,
          tool: 'text',
          x: pos.x,
          y: pos.y,
          text,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          timestamp: Date.now()
        };
        
        const newDrawings = [...drawings, drawingData];
        setDrawings(newDrawings);
        saveToHistory(newDrawings);
        socketRef.current?.emit('whiteboard-draw', drawingData);
      }
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || tool !== 'pen') return;
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    setCurrentPath(prev => [...prev, point.x, point.y]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    if (tool === 'pen' && currentPath.length > 0) {
      const drawingData: DrawingData = {
        id: `line_${Date.now()}`,
        tool: 'pen',
        points: currentPath,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        timestamp: Date.now()
      };
      
      const newDrawings = [...drawings, drawingData];
      setDrawings(newDrawings);
      saveToHistory(newDrawings);
      socketRef.current?.emit('whiteboard-draw', drawingData);
    }
    
    setCurrentPath([]);
  };

  const handleShapeEnd = (e: any) => {
    if (tool === 'pen' || tool === 'text' || tool === 'eraser') return;
    
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    node.scaleX(1);
    node.scaleY(1);
    
    const drawingData: DrawingData = {
      id: `${tool}_${Date.now()}`,
      tool: tool as 'rect' | 'circle' | 'arrow',
      x: node.x(),
      y: node.y(),
      width: Math.max(5, node.width() * scaleX),
      height: Math.max(5, node.height() * scaleY),
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      fill: fillColor,
      timestamp: Date.now()
    };
    
    const newDrawings = [...drawings, drawingData];
    setDrawings(newDrawings);
    saveToHistory(newDrawings);
    socketRef.current?.emit('whiteboard-draw', drawingData);
  };

  const clearWhiteboard = () => {
    if (window.confirm('Clear the whiteboard? This action cannot be undone.')) {
      setDrawings([]);
      setHistory([[]]);
      setHistoryStep(0);
      socketRef.current?.emit('whiteboard-clear');
    }
  };

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      const newDrawings = history[newStep];
      setDrawings([...newDrawings]);
      setHistoryStep(newStep);
      socketRef.current?.emit('whiteboard-undo', newDrawings);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      const newDrawings = history[newStep];
      setDrawings([...newDrawings]);
      setHistoryStep(newStep);
      socketRef.current?.emit('whiteboard-undo', newDrawings);
    }
  };

  const renderDrawing = (drawing: DrawingData) => {
    switch (drawing.tool) {
      case 'pen':
        return (
          <Line
            key={drawing.id}
            points={drawing.points || []}
            stroke={drawing.stroke}
            strokeWidth={drawing.strokeWidth}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        );
      case 'rect':
        return (
          <Rect
            key={drawing.id}
            x={drawing.x}
            y={drawing.y}
            width={drawing.width}
            height={drawing.height}
            stroke={drawing.stroke}
            strokeWidth={drawing.strokeWidth}
            fill={drawing.fill}
          />
        );
      case 'circle':
        return (
          <Circle
            key={drawing.id}
            x={(drawing.x || 0) + (drawing.width || 0) / 2}
            y={(drawing.y || 0) + (drawing.height || 0) / 2}
            radius={Math.min(drawing.width || 0, drawing.height || 0) / 2}
            stroke={drawing.stroke}
            strokeWidth={drawing.strokeWidth}
            fill={drawing.fill}
          />
        );
      case 'arrow':
        return (
          <Arrow
            key={drawing.id}
            points={[
              drawing.x || 0,
              drawing.y || 0,
              (drawing.x || 0) + (drawing.width || 0),
              (drawing.y || 0) + (drawing.height || 0)
            ]}
            stroke={drawing.stroke}
            strokeWidth={drawing.strokeWidth}
            fill={drawing.stroke}
          />
        );
      case 'text':
        return (
          <Text
            key={drawing.id}
            x={drawing.x}
            y={drawing.y}
            text={drawing.text}
            fontSize={drawing.strokeWidth * 8}
            fill={drawing.stroke}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading whiteboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-gray-100 border-b border-gray-300 p-4">
        <div className="flex items-center justify-between">
          {/* Tools */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-4">
              <button
                onClick={() => setTool('pen')}
                className={`p-2 rounded ${tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                title="Pen"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setTool('rect')}
                className={`p-2 rounded ${tool === 'rect' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                title="Rectangle"
              >
                <Square3Stack3DIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setTool('circle')}
                className={`p-2 rounded ${tool === 'circle' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                title="Circle"
              >
                <CircleStackIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setTool('arrow')}
                className={`p-2 rounded ${tool === 'arrow' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                title="Arrow"
              >
                <ArrowUpIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setTool('text')}
                className={`p-2 rounded ${tool === 'text' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                title="Text"
              >
                <span className="font-bold text-sm">T</span>
              </button>
            </div>

            {/* Colors */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-4">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setStrokeColor(color)}
                  className={`w-6 h-6 rounded border-2 ${strokeColor === color ? 'border-gray-800' : 'border-gray-300'}`}
                  style={{ backgroundColor: color }}
                  title={`Color: ${color}`}
                />
              ))}
            </div>

            {/* Stroke Width */}
            <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
              <span className="text-sm text-gray-600">Width:</span>
              <select
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                {STROKE_WIDTHS.map(width => (
                  <option key={width} value={width}>{width}px</option>
                ))}
              </select>
            </div>

            {/* Fill Color */}
            <div className="flex items-center space-x-2 border-r border-gray-300 pr-4">
              <span className="text-sm text-gray-600">Fill:</span>
              <button
                onClick={() => setFillColor('transparent')}
                className={`px-2 py-1 border rounded text-sm ${fillColor === 'transparent' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
              >
                None
              </button>
              <button
                onClick={() => setFillColor(strokeColor)}
                className="w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: strokeColor }}
                title="Fill with stroke color"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={undo}
              disabled={historyStep <= 0}
              className="p-2 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              title="Undo"
            >
              <ArrowUturnLeftIcon className="w-5 h-5" />
            </button>
            
            <button
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="p-2 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              title="Redo"
            >
              <ArrowUturnRightIcon className="w-5 h-5" />
            </button>
            
            <button
              onClick={clearWhiteboard}
              className="p-2 bg-red-500 text-white hover:bg-red-600 rounded"
              title="Clear All"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-white overflow-hidden">
        <Stage
          ref={stageRef}
          width={window?.innerWidth * 0.8 || 800}
          height={window?.innerHeight * 0.6 || 600}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
        >
          <Layer>
            {/* Render all drawings */}
            {drawings.map(renderDrawing)}
            
            {/* Render current drawing path */}
            {isDrawing && tool === 'pen' && currentPath.length > 0 && (
              <Line
                points={currentPath}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}