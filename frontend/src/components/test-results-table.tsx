'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle, XCircle, Clock, Globe, Server, Activity, ChevronDown, ChevronUp, Filter, Settings } from 'lucide-react'

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
  target: string
}

interface TestResultsTableProps {
  results: TestResult[]
  configs: TestConfig[]
  timeRange: string
  setTimeRange: (value: string) => void
  selectedConfigId: string
  setSelectedConfigId: (value: string) => void
  timezone: string
}

export function TestResultsTable({ 
  results, 
  configs, 
  timeRange, 
  setTimeRange, 
  selectedConfigId, 
  setSelectedConfigId,
  timezone
}: TestResultsTableProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  const toggleExpanded = (resultId: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedResults(newExpanded)
  }
  const getConfigName = (configId: string) => {
    const config = configs.find(c => c.id === configId)
    return config?.name || 'Unknown'
  }

  const getConfigType = (configId: string) => {
    const config = configs.find(c => c.id === configId)
    return config?.test_type || 'unknown'
  }

  const formatTimestamp = (timestamp: string) => {
    let date: Date
    
    // Handle old timestamps without timezone info (treat as UTC)
    if (!timestamp.includes('+') && !timestamp.endsWith('Z')) {
      date = new Date(timestamp + 'Z') // Add Z to treat as UTC
    } else {
      date = new Date(timestamp) // Already has timezone info
    }
    
    console.log('formatTimestamp called:', {
      originalTimestamp: timestamp,
      parsedDate: date.toISOString(),
      selectedTimezone: timezone,
      formattedResult: date.toLocaleString('en-US', {
        timeZone: timezone,
        hour12: true,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    })
    
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      hour12: true,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatResponseTime = (time?: number) => {
    if (!time) return '-'
    if (time < 1) return `${(time * 1000).toFixed(0)}ms`
    return `${time.toFixed(2)}s`
  }

  const formatTestDetails = (result: TestResult) => {
    const isExpanded = expandedResults.has(result.id)
    
    if (result.error) {
      return (
        <div className="flex items-center space-x-2 text-red-600">
          <XCircle className="w-4 h-4" />
          <span className="text-sm">{result.error}</span>
        </div>
      )
    }

    if (!result.data) return '-'

    const testType = getConfigType(result.config_id)
    const { data } = result

    switch (testType) {
      case 'ping':
        return (
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-green-600" />
            <div className="text-sm">
              {data.rtt ? (
                <span>RTT: <strong>{data.rtt}ms</strong></span>
              ) : (
                <span>Ping successful</span>
              )}
            </div>
          </div>
        )

      case 'http':
        return (
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <div className="text-sm">
              <div>Status: <strong>{data.status_code}</strong></div>
              <div className="text-muted-foreground">
                Size: {(data.content_length / 1024).toFixed(1)}KB
              </div>
            </div>
          </div>
        )

      case 'dns':
        const successfulServers = data.results?.filter((r: any) => r.success) || []
        
        // Separate local and public DNS servers
        const localServers = successfulServers.filter((r: any) => 
          !['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1'].includes(r.server)
        )
        const publicServers = successfulServers.filter((r: any) => 
          ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1'].includes(r.server)
        )
        
        const hasPublicServers = publicServers.length > 0
        const serversToShow = isExpanded 
          ? [...localServers, ...publicServers] 
          : localServers
        
        return (
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-purple-600" />
            <div className="text-sm">
              <div>Type: <strong>{data.record_type}</strong></div>
              {data.servers_tested && (
                <div className="text-muted-foreground">
                  {data.successful_queries}/{data.servers_tested} servers ({data.success_rate?.toFixed(1)}%)
                </div>
              )}
              {serversToShow.length > 0 && (
                <div className="text-xs space-y-1 mt-1">
                  {serversToShow.map((serverResult: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-muted-foreground">{serverResult.server}:</span>
                      <span className="font-mono">{serverResult.response_time?.toFixed(1)}ms</span>
                    </div>
                  ))}
                  {hasPublicServers && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => toggleExpanded(result.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3 mr-1" />
                          Hide public DNS
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3 mr-1" />
                          Show public DNS ({publicServers.length})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )

      case 'traceroute':
        return (
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-orange-600" />
            <div className="text-sm">
              <span>Traceroute completed</span>
              <div className="text-xs text-muted-foreground">
                {data.output?.split('\n').length - 1 || 0} hops
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-sm text-muted-foreground">
            {JSON.stringify(data).slice(0, 50)}...
          </div>
        )
    }
  }

  const getTestTypeIcon = (testType: string) => {
    switch (testType) {
      case 'ping': return <Activity className="w-4 h-4" />
      case 'http': return <Globe className="w-4 h-4" />
      case 'dns': return <Server className="w-4 h-4" />
      case 'traceroute': return <Activity className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Test Results</CardTitle>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="time-range">Time Range:</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="test-filter">Test:</Label>
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tests</SelectItem>
                  {configs.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response Time</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.slice(0, 20).map((result) => {
              const testType = getConfigType(result.config_id)
              return (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      {getTestTypeIcon(testType)}
                      <div>
                        <div>{getConfigName(result.config_id)}</div>
                        <div className="text-xs text-muted-foreground uppercase">
                          {testType}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Success</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <XCircle className="w-3 h-3" />
                          <span>Failed</span>
                        </div>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>{formatResponseTime(result.response_time)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatTestDetails(result)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTimestamp(result.timestamp)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
