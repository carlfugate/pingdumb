'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface TestConfig {
  id?: string
  name: string
  test_type: string
  target: string
  interval: number
  timeout: number
  enabled: boolean
}

interface TestConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: any) => void
  editingConfig?: TestConfig | null
}

export function TestConfigDialog({ open, onOpenChange, onSave, editingConfig }: TestConfigDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    test_type: 'ping',
    target: '',
    interval: 30,
    timeout: 5,
    enabled: true,
    dns_servers: [] as string[]
  })

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        name: editingConfig.name,
        test_type: editingConfig.test_type,
        target: editingConfig.target,
        interval: editingConfig.interval,
        timeout: editingConfig.timeout,
        enabled: editingConfig.enabled,
        dns_servers: (editingConfig as any).dns_servers || []
      })
    } else {
      setFormData({
        name: '',
        test_type: 'ping',
        target: '',
        interval: 30,
        timeout: 5,
        enabled: true,
        dns_servers: []
      })
    }
  }, [editingConfig, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const configData = editingConfig 
      ? { ...formData, id: editingConfig.id }
      : formData
    onSave(configData)
  }

  const presetTargets = {
    ping: [
      { label: 'Google DNS', value: '8.8.8.8' },
      { label: 'Cloudflare DNS', value: '1.1.1.1' },
      { label: 'Local Gateway', value: '192.168.1.1' },
      { label: 'AWS DNS', value: '8.8.4.4' }
    ],
    http: [
      { label: 'Google', value: 'https://google.com' },
      { label: 'Cloudflare', value: 'https://cloudflare.com' },
      { label: 'AWS', value: 'https://aws.amazon.com' },
      { label: 'GitHub', value: 'https://github.com' }
    ],
    dns: [
      { label: 'Google A Record', value: 'google.com:A' },
      { label: 'Cloudflare A Record', value: 'cloudflare.com:A' },
      { label: 'AWS MX Record', value: 'amazon.com:MX' },
      { label: 'Custom NS', value: 'example.com:NS' }
    ],
    traceroute: [
      { label: 'Google DNS', value: '8.8.8.8' },
      { label: 'Google.com', value: 'google.com' },
      { label: 'AWS', value: 'aws.amazon.com' },
      { label: 'Cloudflare', value: '1.1.1.1' }
    ],
    speedtest_ookla: [
      { label: 'Auto Server', value: 'auto' },
      { label: 'Specific Server', value: '12345' }
    ],
    speedtest_fast: [
      { label: 'Default', value: 'default' }
    ],
    iperf3: [
      { label: 'Local Server', value: 'localhost:5201' },
      { label: 'Custom Server', value: 'server.example.com:5201' }
    ]
  }

  const intervalPresets = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '5m', value: 300 },
    { label: '15m', value: 900 },
    { label: '30m', value: 1800 },
    { label: '1h', value: 3600 }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? 'Edit Network Test' : 'Add Network Test'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Test Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Google DNS"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test_type">Test Type</Label>
              <Select
                value={formData.test_type}
                onValueChange={(value) => setFormData({ ...formData, test_type: value, target: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ping">Ping</SelectItem>
                  <SelectItem value="http">HTTP/HTTPS</SelectItem>
                  <SelectItem value="dns">DNS Lookup</SelectItem>
                  <SelectItem value="traceroute">Traceroute</SelectItem>
                  <SelectItem value="speedtest_ookla">Speedtest (Ookla)</SelectItem>
                  <SelectItem value="speedtest_fast">Speedtest (Fast.com)</SelectItem>
                  <SelectItem value="iperf3">iPerf3 Bandwidth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target">Target</Label>
            <Input
              id="target"
              value={formData.target}
              onChange={(e) => setFormData({ ...formData, target: e.target.value })}
              placeholder={
                formData.test_type === 'ping' ? 'IP address or hostname' :
                formData.test_type === 'http' ? 'https://example.com' :
                formData.test_type === 'dns' ? 'domain.com:A' :
                formData.test_type === 'speedtest_ookla' ? 'auto or server ID' :
                formData.test_type === 'speedtest_fast' ? 'default' :
                formData.test_type === 'iperf3' ? 'server:port' :
                'IP address or hostname'
              }
              required
            />
            <div className="flex flex-wrap gap-1">
              {presetTargets[formData.test_type as keyof typeof presetTargets]?.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, target: preset.value })}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interval">Test Interval</Label>
              <Select
                value={formData.interval.toString()}
                onValueChange={(value) => setFormData({ ...formData, interval: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervalPresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value.toString()}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                min="1"
                max="30"
              />
            </div>
          </div>

          {formData.test_type === 'dns' && (
            <div className="space-y-2">
              <Label>DNS Servers to Test</Label>
              <div className="space-y-2">
                {['Local DNS', 'Google (8.8.8.8)', 'Cloudflare (1.1.1.1)', 'Google Alt (8.8.4.4)', 'Cloudflare Alt (1.0.0.1)'].map((server, index) => {
                  const serverValues = ['local', '8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']
                  const isChecked = formData.dns_servers.length === 0 || formData.dns_servers.includes(serverValues[index])
                  
                  return (
                    <div key={server} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`dns-${index}`}
                        checked={isChecked}
                        onChange={(e) => {
                          const serverValue = serverValues[index]
                          if (e.target.checked) {
                            if (!formData.dns_servers.includes(serverValue)) {
                              setFormData({
                                ...formData,
                                dns_servers: [...formData.dns_servers, serverValue]
                              })
                            }
                          } else {
                            setFormData({
                              ...formData,
                              dns_servers: formData.dns_servers.filter(s => s !== serverValue)
                            })
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={`dns-${index}`} className="text-sm">{server}</Label>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked to test against all available servers (recommended)
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label htmlFor="enabled">Enable this test</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingConfig ? 'Update Test' : 'Add Test'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
