'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
}

export function TestHistoryGraph({ config, results }: TestHistoryGraphProps) {
  // Use DNS multi-server graph for DNS tests
  if (config.test_type === 'dns') {
    return <DnsMultiServerGraph config={config} results={results} />
  }

  // Filter and prepare data for this specific config
  const configResults = results
    .filter(r => r.config_id === config.id && r.success)
    .slice(0, 20) // Last 20 data points
    .reverse() // Show chronologically
    .map(r => {
      let responseTime = 0
      
      // Handle different test types
      if (config.test_type === 'dns' && r.data?.avg_response_time) {
        responseTime = r.data.avg_response_time // Already in ms for DNS
      } else if (r.response_time) {
        responseTime = r.response_time * 1000 // Convert to ms for other types
      }
      
      return {
        time: new Date(r.timestamp).toLocaleTimeString(),
        responseTime: responseTime,
        success: r.success,
        // Add DNS-specific data for tooltip
        ...(config.test_type === 'dns' && r.data ? {
          successRate: r.data.success_rate,
          serversCount: r.data.servers_tested
        } : {})
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm">{config.name} - Response Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={configResults}>
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
              formatter={(value: number, name: string, props: any) => {
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
              }}
              labelStyle={{ fontSize: '12px' }}
              contentStyle={{ fontSize: '12px' }}
            />
            <Line 
              type="monotone" 
              dataKey="responseTime" 
              stroke={getLineColor()}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
