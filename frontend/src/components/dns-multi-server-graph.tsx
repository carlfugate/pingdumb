'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TestResult {
  id: string
  config_id: string
  timestamp: string
  success: boolean
  response_time?: number
  error?: string
  data?: any
}

interface TestConfig {
  id: string
  name: string
  test_type: string
}

interface DnsMultiServerGraphProps {
  config: TestConfig
  results: TestResult[]
  timeFrame: string
  setTimeFrame: (value: string | null) => void
  globalTimeFrame?: string
}

export function DnsMultiServerGraph({ config, results, timeFrame, setTimeFrame, globalTimeFrame }: DnsMultiServerGraphProps) {
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
  const timeFrameMs = parseInt(timeFrame) * 60 * 1000 // Convert minutes to milliseconds
  const cutoffTime = new Date(now.getTime() - timeFrameMs)

  // Filter DNS results for this config
  const dnsResults = results
    .filter(r => r.config_id === config.id && r.success && r.data?.results)
    .filter(r => new Date(r.timestamp) >= cutoffTime) // Filter by time frame
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) // Sort chronologically

  if (dnsResults.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{config.name} - DNS Server Response Times</CardTitle>
            <Select value={timeFrame === globalTimeFrame ? 'global' : timeFrame} onValueChange={(value) => setTimeFrame(value === 'global' ? null : value)}>
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
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            No DNS data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get all unique servers across all results
  const allServers = new Set<string>()
  dnsResults.forEach(result => {
    result.data?.results?.forEach((serverResult: any) => {
      if (serverResult.success) {
        allServers.add(serverResult.server)
      }
    })
  })

  const serverList = Array.from(allServers).sort()

  // Prepare chart data
  const chartData = dnsResults.map(result => {
    const dataPoint: any = {
      time: new Date(result.timestamp).toLocaleTimeString()
    }
    
    // Add response time for each server
    result.data?.results?.forEach((serverResult: any) => {
      if (serverResult.success) {
        dataPoint[serverResult.server] = serverResult.response_time
      }
    })
    
    return dataPoint
  })

  // Color palette for different servers
  const colors = [
    '#10b981', // green
    '#3b82f6', // blue  
    '#8b5cf6', // purple
    '#f59e0b', // orange
    '#ef4444', // red
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316'  // orange-500
  ]

  const getServerLabel = (server: string) => {
    if (server === '8.8.8.8') return 'Google'
    if (server === '8.8.4.4') return 'Google Alt'
    if (server === '1.1.1.1') return 'Cloudflare'
    if (server === '1.0.0.1') return 'Cloudflare Alt'
    if (server.startsWith('192.168.') || server.startsWith('10.') || server.startsWith('172.')) return 'Local'
    return server
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{config.name} - DNS Server Response Times</CardTitle>
          <Select value={timeFrame === globalTimeFrame ? 'global' : timeFrame} onValueChange={(value) => setTimeFrame(value === 'global' ? null : value)}>
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
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              label={{ value: 'ms', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${value?.toFixed(1)}ms`, 
                getServerLabel(name)
              ]}
              labelStyle={{ fontSize: '12px' }}
              contentStyle={{ fontSize: '12px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '10px' }}
              formatter={(value) => getServerLabel(value)}
            />
            {serverList.map((server, index) => (
              <Line 
                key={server}
                type="monotone" 
                dataKey={server}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
