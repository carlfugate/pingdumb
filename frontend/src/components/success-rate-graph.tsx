'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TestResult {
  id: string
  config_id: string
  timestamp: string
  success: boolean
  response_time?: number
}

interface SuccessRateGraphProps {
  results: TestResult[]
  globalTimeFrame?: string
}

export function SuccessRateGraph({ results, globalTimeFrame }: SuccessRateGraphProps) {
  const [localTimeFrame, setLocalTimeFrame] = useState<string | null>(null) // null means use global
  
  // Use local time frame if set, otherwise use global
  const effectiveTimeFrame = localTimeFrame || globalTimeFrame || '60'

  const timeFrameOptions = [
    { value: '5', label: '5 min' },
    { value: '15', label: '15 min' },
    { value: '30', label: '30 min' },
    { value: '60', label: '1 hour' },
    { value: '240', label: '4 hours' },
    { value: '720', label: '12 hours' },
    { value: '1440', label: '24 hours' }
  ]

  // Filter results by time frame
  const now = new Date()
  const timeFrameMs = parseInt(effectiveTimeFrame) * 60 * 1000 // Convert minutes to milliseconds
  const cutoffTime = new Date(now.getTime() - timeFrameMs)

  const filteredResults = results.filter(r => new Date(r.timestamp) >= cutoffTime)

  // Group results by time intervals (every 5 minutes)
  const timeGroups = new Map<string, { total: number; successful: number }>()
  
  filteredResults.forEach(result => {
    const time = new Date(result.timestamp)
    const timeKey = `${time.getHours()}:${Math.floor(time.getMinutes() / 5) * 5}`
    
    if (!timeGroups.has(timeKey)) {
      timeGroups.set(timeKey, { total: 0, successful: 0 })
    }
    
    const group = timeGroups.get(timeKey)!
    group.total++
    if (result.success) group.successful++
  })

  const chartData = Array.from(timeGroups.entries())
    .map(([time, data]) => ({
      time,
      successRate: (data.successful / data.total) * 100,
      total: data.total
    }))
    .sort((a, b) => a.time.localeCompare(b.time))

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Success Rate Over Time</CardTitle>
            <Select value={localTimeFrame || 'global'} onValueChange={(value) => setLocalTimeFrame(value === 'global' ? null : value)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global" className="text-xs">Global</SelectItem>
                {timeFrameOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Success Rate Over Time</CardTitle>
          <Select value={localTimeFrame || 'global'} onValueChange={(value) => setLocalTimeFrame(value === 'global' ? null : value)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global" className="text-xs">Global</SelectItem>
              {timeFrameOptions.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              domain={[0, 100]}
              label={{ value: '%', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Success Rate']}
              labelStyle={{ fontSize: '12px' }}
              contentStyle={{ fontSize: '12px' }}
            />
            <Area 
              type="monotone" 
              dataKey="successRate" 
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
