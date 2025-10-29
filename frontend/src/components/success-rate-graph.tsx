'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TestResult {
  id: string
  config_id: string
  timestamp: string
  success: boolean
  response_time?: number
}

interface SuccessRateGraphProps {
  results: TestResult[]
}

export function SuccessRateGraph({ results }: SuccessRateGraphProps) {
  // Group results by time intervals (every 5 minutes)
  const timeGroups = new Map<string, { total: number; successful: number }>()
  
  results.slice(0, 100).forEach(result => {
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
    .slice(-12) // Last 12 time periods

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Success Rate Over Time</CardTitle>
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
        <CardTitle className="text-sm">Success Rate Over Time</CardTitle>
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
