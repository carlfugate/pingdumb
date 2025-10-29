'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TestConfigDialog } from '@/components/test-config-dialog'
import { TestHistoryGraph } from '@/components/test-history-graph'
import { DnsMultiServerGraph } from '@/components/dns-multi-server-graph'
import { SuccessRateGraph } from '@/components/success-rate-graph'
import { TestResultsTable } from '@/components/test-results-table'
import { Plus, Activity, AlertCircle, CheckCircle, Edit, Settings, BarChart3, Cog, Filter, Clock } from 'lucide-react'

interface TestConfig {
  id: string
  name: string
  test_type: string
  target: string
  interval: number
  enabled: boolean
}

interface TestResult {
  id: string
  config_id: string
  timestamp: string
  success: boolean
  response_time?: number
  error?: string
  data?: any
}

export default function Dashboard() {
  const [configs, setConfigs] = useState<TestConfig[]>([])
  const [results, setResults] = useState<TestResult[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<TestConfig | null>(null)
  const [globalInterval, setGlobalInterval] = useState(30)
  const [globalTimeFrame, setGlobalTimeFrame] = useState('60') // Global time frame in minutes
  const [selectedConfigId, setSelectedConfigId] = useState<string>('all') // Filter by test config
  const [timeRange, setTimeRange] = useState('1h') // Time range filter
  const [timezone, setTimezone] = useState('America/Chicago') // Default to Central US time
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    fetchConfigs()
    fetchResults()
    connectWebSocket()

    return () => {
      if (ws) ws.close()
    }
  }, [])

  useEffect(() => {
    fetchResults()
  }, [selectedConfigId, timeRange])

  const fetchConfigs = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/configs')
      const data = await response.json()
      setConfigs(data)
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    }
  }

  const fetchResults = async () => {
    try {
      const params = new URLSearchParams()
      
      // Add time range filter
      const now = new Date()
      let since = new Date()
      switch (timeRange) {
        case '1h': since.setHours(now.getHours() - 1); break
        case '6h': since.setHours(now.getHours() - 6); break
        case '24h': since.setHours(now.getHours() - 24); break
        case '7d': since.setDate(now.getDate() - 7); break
        case '30d': since.setDate(now.getDate() - 30); break
      }
      params.append('since', since.toISOString())
      
      // Add config filter
      if (selectedConfigId !== 'all') {
        params.append('config_id', selectedConfigId)
      }
      
      const response = await fetch(`http://localhost:8000/api/results?${params}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Failed to fetch results:', error)
    }
  }

  const connectWebSocket = () => {
    const websocket = new WebSocket('ws://localhost:8000/ws')
    
    websocket.onmessage = (event) => {
      const result = JSON.parse(event.data)
      setResults(prev => [result, ...prev.slice(0, 99)])
    }

    websocket.onopen = () => {
      console.log('WebSocket connected')
      setWs(websocket)
    }

    websocket.onclose = () => {
      console.log('WebSocket disconnected')
      setTimeout(connectWebSocket, 5000)
    }
  }

  const handleConfigSave = async (config: Partial<TestConfig>) => {
    try {
      const method = editingConfig ? 'PUT' : 'POST'
      const url = editingConfig 
        ? `http://localhost:8000/api/configs/${editingConfig.id}`
        : 'http://localhost:8000/api/configs'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      
      if (response.ok) {
        fetchConfigs()
        setIsDialogOpen(false)
        setEditingConfig(null)
      }
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  const handleConfigEdit = (config: TestConfig) => {
    setEditingConfig(config)
    setIsDialogOpen(true)
  }

  const handleConfigDelete = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/configs/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchConfigs()
      }
    } catch (error) {
      console.error('Failed to delete config:', error)
    }
  }

  const updateGlobalInterval = async () => {
    const updates = configs.map(config => ({
      ...config,
      interval: globalInterval
    }))
    
    for (const config of updates) {
      await handleConfigSave(config)
    }
  }

  const getLatestResult = (configId: string) => {
    return results.find(r => r.config_id === configId)
  }

  const getStatusStats = () => {
    const total = configs.length
    const active = configs.filter(c => c.enabled).length
    const recent = results.slice(0, total)
    const successful = recent.filter(r => r.success).length
    const failed = recent.filter(r => !r.success).length

    return { total, active, successful, failed }
  }

  const formatTestDetails = (result: TestResult) => {
    if (!result.data) return null
    
    const { data } = result
    
    if (result.config_id && configs.find(c => c.id === result.config_id)?.test_type === 'ping') {
      return data.rtt ? `${data.rtt}ms RTT` : 'Ping successful'
    }
    
    if (result.config_id && configs.find(c => c.id === result.config_id)?.test_type === 'http') {
      return `${data.status_code} (${(data.content_length / 1024).toFixed(1)}KB)`
    }
    
    if (result.config_id && configs.find(c => c.id === result.config_id)?.test_type === 'dns') {
      return `${data.answers?.length || 0} records`
    }
    
    return 'Success'
  }

  const stats = getStatusStats()

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">pingdumb</h1>
            <p className="text-muted-foreground">Real-time network diagnostics and monitoring</p>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="timezone">Timezone:</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Chicago">Central US (Chicago)</SelectItem>
                <SelectItem value="America/New_York">Eastern US (New York)</SelectItem>
                <SelectItem value="America/Denver">Mountain US (Denver)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific US (Los Angeles)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Europe/Paris">Paris</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>History</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center space-x-2">
              <Cog className="w-4 h-4" />
              <span>Configuration</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.active}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Successful</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Current Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {configs.slice(0, 6).map((config) => {
                      const latestResult = getLatestResult(config.id)
                      const details = latestResult ? formatTestDetails(latestResult) : null
                      
                      return (
                        <div key={config.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs">
                              {config.test_type.toUpperCase()}
                            </Badge>
                            <div>
                              <h4 className="font-medium text-sm">{config.name}</h4>
                              <p className="text-xs text-muted-foreground">{config.target}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {latestResult && (
                              <>
                                <Badge variant={latestResult.success ? "default" : "destructive"} className="text-xs">
                                  {latestResult.success ? "OK" : "FAIL"}
                                </Badge>
                                {details && (
                                  <p className="text-xs text-muted-foreground mt-1">{details}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Avg Response Time:</span>
                    <span className="font-medium">
                      {results.length > 0 
                        ? `${(results.filter(r => r.response_time).reduce((acc, r) => acc + (r.response_time! * 1000), 0) / results.filter(r => r.response_time).length).toFixed(1)}ms`
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Success Rate:</span>
                    <span className="font-medium text-green-600">
                      {results.length > 0 
                        ? `${((results.filter(r => r.success).length / results.length) * 100).toFixed(1)}%`
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Tests:</span>
                    <span className="font-medium">{results.length}</span>
                  </div>
                  <div className="pt-2">
                    <SuccessRateGraph results={results} globalTimeFrame={globalTimeFrame} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <TestResultsTable 
              results={results} 
              configs={configs}
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              selectedConfigId={selectedConfigId}
              setSelectedConfigId={setSelectedConfigId}
              timezone={timezone}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Response Time History</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="global-timeframe" className="text-sm">Default Time Frame:</Label>
                    <Select value={globalTimeFrame} onValueChange={setGlobalTimeFrame}>
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5" className="text-xs">5 min</SelectItem>
                        <SelectItem value="15" className="text-xs">15 min</SelectItem>
                        <SelectItem value="30" className="text-xs">30 min</SelectItem>
                        <SelectItem value="60" className="text-xs">1 hour</SelectItem>
                        <SelectItem value="240" className="text-xs">4 hours</SelectItem>
                        <SelectItem value="720" className="text-xs">12 hours</SelectItem>
                        <SelectItem value="1440" className="text-xs">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {configs.filter(c => c.enabled).map((config) => (
                    <TestHistoryGraph 
                      key={config.id} 
                      config={config} 
                      results={results}
                      globalTimeFrame={globalTimeFrame}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Test Configuration</h2>
                <p className="text-muted-foreground">Manage your network monitoring tests</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <Label htmlFor="global-interval">Global Interval (s):</Label>
                  <Input
                    id="global-interval"
                    type="number"
                    value={globalInterval}
                    onChange={(e) => setGlobalInterval(parseInt(e.target.value))}
                    className="w-20"
                    min="10"
                    max="3600"
                  />
                  <Button size="sm" onClick={updateGlobalInterval}>Apply</Button>
                </div>
                <Button onClick={() => { setEditingConfig(null); setIsDialogOpen(true) }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Test
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Test Configurations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {configs.map((config) => {
                    const latestResult = getLatestResult(config.id)
                    const details = latestResult ? formatTestDetails(latestResult) : null
                    
                    return (
                      <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                        <div className="flex items-center space-x-4">
                          <Badge variant={config.enabled ? "default" : "secondary"}>
                            {config.test_type.toUpperCase()}
                          </Badge>
                          <div>
                            <h3 className="font-medium">{config.name}</h3>
                            <p className="text-sm text-muted-foreground">{config.target}</p>
                            <p className="text-xs text-muted-foreground">Every {config.interval}s</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {latestResult && (
                            <div className="text-right">
                              <Badge variant={latestResult.success ? "default" : "destructive"}>
                                {latestResult.success ? "OK" : "FAIL"}
                              </Badge>
                              {details && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {details}
                                </p>
                              )}
                              {latestResult.response_time && (
                                <p className="text-xs text-muted-foreground">
                                  {latestResult.response_time.toFixed(2)}ms
                                </p>
                              )}
                            </div>
                          )}
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConfigEdit(config)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleConfigDelete(config.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <TestConfigDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSave={handleConfigSave}
          editingConfig={editingConfig}
        />
      </div>
    </div>
  )
}
