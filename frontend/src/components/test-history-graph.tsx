'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DnsMultiServerGraph } from './dns-multi-server-graph'

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

interface TestHistoryGraphProps {
  config: TestConfig
  results: TestResult[]
  globalTimeFrame?: string
}

export function TestHistoryGraph({ config, results, globalTimeFrame }: TestHistoryGraphProps) {
  const [localTimeFrame, setLocalTimeFrame] = useState<string | null>(null) // null means use global
  const [renderKey, setRenderKey] = useState(0)
  
  // Use local time frame if set, otherwise use global
  const effectiveTimeFrame = localTimeFrame || globalTimeFrame || '60'

  // Force re-render when effective time frame changes
  useEffect(() => {
    setRenderKey(prev => prev + 1)
  }, [effectiveTimeFrame])

  const timeFrameOptions = [
    { value: '5', label: '5 min' },
    { value: '15', label: '15 min' },
    { value: '30', label: '30 min' },
    { value: '60', label: '1 hour' },
    { value: '240', label: '4 hours' },
    { value: '720', label: '12 hours' },
    { value: '1440', label: '24 hours' }
  ]

  // Use DNS multi-server graph for DNS tests
  if (config.test_type === 'dns') {
    return <DnsMultiServerGraph 
      config={config} 
      results={results} 
      timeFrame={effectiveTimeFrame} 
      setTimeFrame={setLocalTimeFrame}
      globalTimeFrame={globalTimeFrame}
    />
  }

  // Filter results by time frame
  const now = new Date()
  const timeFrameMs = parseInt(effectiveTimeFrame) * 60 * 1000 // Convert minutes to milliseconds
  const cutoffTime = new Date(now.getTime() - timeFrameMs)

  // Filter and prepare data for this specific config
  const configResults = results
    .filter(r => r.config_id === config.id && r.success)
    .filter(r => new Date(r.timestamp) >= cutoffTime) // Filter by time frame
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) // Sort chronologically
    .map(r => {
      // Format time based on time frame
      const date = new Date(r.timestamp)
      let time: string
      
      const timeFrameMinutes = parseInt(effectiveTimeFrame)
      if (timeFrameMinutes <= 60) {
        // Short periods: show time only
        time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } else if (timeFrameMinutes <= 1440) {
        // Medium periods: show time with AM/PM
        time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      } else {
        // Long periods: show date and time
        time = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
               date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }
      
      // Handle speedtest types differently
      if (config.test_type === 'speedtest_ookla') {
        return {
          time,
          download: r.data?.download_mbps || 0,
          upload: r.data?.upload_mbps || 0,
          ping: r.data?.ping_ms || 0,
          success: r.success
        }
      } else if (config.test_type === 'speedtest_fast') {
        return {
          time,
          download: r.data?.download_mbps || 0,
          success: r.success
        }
      } else if (config.test_type === 'iperf3') {
        return {
          time,
          upload: r.data?.upload_mbps || 0,
          download: r.data?.download_mbps || 0,
          upload_retransmits: r.data?.upload_retransmits || 0,
          download_retransmits: r.data?.download_retransmits || 0,
          success: r.success
        }
      } else {
        // Regular tests - use response time
        let responseTime = 0
        
        if (config.test_type === 'dns' && r.data?.avg_response_time) {
          responseTime = r.data.avg_response_time // Already in ms for DNS
        } else if (r.response_time) {
          responseTime = r.response_time * 1000 // Convert to ms for other types
        }
        
        return {
          time,
          responseTime: responseTime,
          success: r.success,
          // Add DNS-specific data for tooltip
          ...(config.test_type === 'dns' && r.data ? {
            successRate: r.data.success_rate,
            serversCount: r.data.servers_tested
          } : {})
        }
      }
    })

  if (configResults.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm">{config.name} - Response Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const getLineColor = () => {
    switch (config.test_type) {
      case 'ping': return '#10b981' // green
      case 'http': return '#3b82f6' // blue
      case 'dns': return '#8b5cf6' // purple
      case 'traceroute': return '#f59e0b' // orange
      default: return '#6b7280' // gray
    }
  }

  const getGraphTitle = () => {
    switch (config.test_type) {
      case 'speedtest_ookla': return `${config.name} - Download/Upload Speed`
      case 'speedtest_fast': return `${config.name} - Download Speed`
      case 'iperf3': return `${config.name} - Upload/Download Speed`
      default: return `${config.name} - Response Time`
    }
  }

  const getYAxisLabel = () => {
    switch (config.test_type) {
      case 'speedtest_ookla':
      case 'speedtest_fast':
      case 'iperf3': return 'Mbps'
      default: return 'ms'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{getGraphTitle()}</CardTitle>
          <Select value={localTimeFrame || 'global'} onValueChange={(value) => setLocalTimeFrame(value === 'global' ? null : value)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global" className="text-xs">Default</SelectItem>
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
        <ResponsiveContainer width="100%" height={120} key={`${config.id}-${effectiveTimeFrame}-${renderKey}`}>
          <LineChart data={configResults}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10 }}
              interval={configResults.length > 20 ? Math.floor(configResults.length / 10) : 'preserveStartEnd'}
              angle={parseInt(effectiveTimeFrame) > 1440 ? -45 : 0}
              textAnchor={parseInt(effectiveTimeFrame) > 1440 ? 'end' : 'middle'}
              height={parseInt(effectiveTimeFrame) > 1440 ? 60 : 30}
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number, name: string, props: any) => {
                if (config.test_type === 'speedtest_ookla') {
                  if (name === 'download') return [`${value.toFixed(1)} Mbps`, 'Download']
                  if (name === 'upload') return [`${value.toFixed(1)} Mbps`, 'Upload']
                  if (name === 'ping') return [`${value.toFixed(0)} ms`, 'Ping']
                } else if (config.test_type === 'speedtest_fast') {
                  return [`${value.toFixed(1)} Mbps`, 'Download']
                } else if (config.test_type === 'iperf3') {
                  if (name === 'upload') return [`${value.toFixed(1)} Mbps`, 'Upload']
                  if (name === 'download') return [`${value.toFixed(1)} Mbps`, 'Download']
                } else {
                  const result = [`${value.toFixed(2)}ms`, 'Avg Response Time']
                  if (config.test_type === 'dns' && props.payload) {
                    if (props.payload.successRate !== undefined) {
                      result.push(`${props.payload.successRate.toFixed(1)}% success rate`)
                    }
                    if (props.payload.serversCount) {
                      result.push(`${props.payload.serversCount} servers tested`)
                    }
                  }
                  return result
                }
              }}
              labelStyle={{ fontSize: '12px' }}
              contentStyle={{ fontSize: '12px' }}
            />
            
            {/* Render different lines based on test type */}
            {config.test_type === 'speedtest_ookla' ? (
              <>
                <Line 
                  type="monotone" 
                  dataKey="download" 
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="upload" 
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </>
            ) : config.test_type === 'speedtest_fast' ? (
              <Line 
                type="monotone" 
                dataKey="download" 
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            ) : config.test_type === 'iperf3' ? (
              <>
                <Line 
                  type="monotone" 
                  dataKey="upload" 
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="download" 
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </>
            ) : (
              <Line 
                type="monotone" 
                dataKey="responseTime" 
                stroke={getLineColor()}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
