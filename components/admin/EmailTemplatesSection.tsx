'use client';

import { useState, useEffect } from 'react';
import { Mail, Save, Send, RefreshCw, Eye, Code, Sparkles, AlertCircle, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface EmailTemplate {
  _id?: string;
  templateType: string;
  name: string;
  subject: string;
  fromName: string;
  headingText: string;
  introText: string;
  featureListLabel: string;
  featureItems: string[];
  closingText: string;
  ctaButtonText: string;
  ctaButtonUrl: string;
  footerAddress: string;
  footerLinks: {
    unsubscribeUrl: string;
    websiteUrl: string;
  };
  useAIPersonalization: boolean;
  aiPersonalizationPrompt: string;
  customHtmlTemplate: string;
  useCustomHtml: boolean;
  isActive: boolean;
}

const DEFAULT_TEMPLATE: EmailTemplate = {
  templateType: 'welcome',
  name: 'Welcome Email',
  subject: 'Welcome to {{platformName}} - Start competing and win real prizes!',
  fromName: '{{platformName}}',
  headingText: 'Welcome aboard {{name}}',
  introText: 'Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.',
  featureListLabel: "Here's what you can do right now:",
  featureItems: [
    'Deposit credits to your wallet and enter trading competitions',
    'Compete in live trading competitions with real-time market prices',
    'Climb the leaderboard by trading smarter and win cash prizes',
  ],
  closingText: "Competitions run daily with prize pools waiting to be won. The top traders take home real money — will you be one of them?",
  ctaButtonText: 'View Competitions',
  ctaButtonUrl: '{{baseUrl}}/competitions',
  footerAddress: '{{companyAddress}}',
  footerLinks: {
    unsubscribeUrl: '#',
    websiteUrl: '{{baseUrl}}',
  },
  useAIPersonalization: true,
  aiPersonalizationPrompt: `Generate a personalized welcome message for a new user joining a trading competition platform.

User profile:
{{userProfile}}

Platform info: This is a trading competition platform where users buy credits, enter competitions, trade forex/stocks with simulated capital, and win real cash prizes based on their performance.

Requirements:
- Write 2-3 sentences maximum
- Be warm and welcoming
- Reference any specific interests if mentioned
- Focus on the excitement of competing and winning
- Keep it professional but friendly
- Do NOT start with "Welcome" (already in heading)

Return only the message text, no HTML.`,
  customHtmlTemplate: '',
  useCustomHtml: false,
  isActive: true,
};

export default function EmailTemplatesSection() {
  const [template, setTemplate] = useState<EmailTemplate>(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [newFeatureItem, setNewFeatureItem] = useState('');

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/email-templates?type=welcome');
      if (response.ok) {
        const data = await response.json();
        if (data.template) {
          setTemplate({ ...DEFAULT_TEMPLATE, ...data.template });
        }
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load email template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (response.ok) {
        toast.success('Email template updated successfully');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Failed to save email template');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    try {
      setSendingTest(true);
      
      // First save the template
      await handleSave();
      
      // Then send test email
      const response = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: 'welcome',
          testEmail,
        }),
      });

      if (response.ok) {
        toast.success(`Test email sent to ${testEmail}`);
        setShowTestDialog(false);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send test email');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  const handleResetToDefault = () => {
    setTemplate(DEFAULT_TEMPLATE);
    toast.info('Template reset to default values (not saved yet)');
  };

  const addFeatureItem = () => {
    if (newFeatureItem.trim()) {
      setTemplate({
        ...template,
        featureItems: [...template.featureItems, newFeatureItem.trim()],
      });
      setNewFeatureItem('');
    }
  };

  const removeFeatureItem = (index: number) => {
    setTemplate({
      ...template,
      featureItems: template.featureItems.filter((_, i) => i !== index),
    });
  };

  const updateFeatureItem = (index: number, value: string) => {
    const newItems = [...template.featureItems];
    newItems[index] = value;
    setTemplate({ ...template, featureItems: newItems });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="h-6 w-6 text-yellow-500" />
            Welcome Email Template
          </h2>
          <p className="text-gray-400 mt-1">
            Customize the email sent to new users when they sign up
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleResetToDefault}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-blue-600 text-blue-400 hover:bg-blue-950">
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle className="text-white">Send Test Email</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Send a test welcome email to preview the template
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="testEmail" className="text-gray-300">
                    Test Email Address
                  </Label>
                  <Input
                    id="testEmail"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <Button
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || !testEmail}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Available Variables Info */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Available Variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            {['{{name}}', '{{platformName}}', '{{baseUrl}}', '{{companyAddress}}'].map((variable) => (
              <code key={variable} className="px-2 py-1 bg-gray-800 rounded text-yellow-400">
                {variable}
              </code>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="content" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Eye className="h-4 w-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Personalization
          </TabsTrigger>
          <TabsTrigger value="advanced" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Code className="h-4 w-4 mr-2" />
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6 mt-6">
          {/* Basic Settings */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Email Settings</CardTitle>
              <CardDescription className="text-gray-400">
                Configure the email subject and sender information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Email Subject</Label>
                  <Input
                    value={template.subject}
                    onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="Welcome to {{platformName}}!"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">From Name</Label>
                  <Input
                    value={template.fromName}
                    onChange={(e) => setTemplate({ ...template, fromName: e.target.value })}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="{{platformName}}"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Email Content</CardTitle>
              <CardDescription className="text-gray-400">
                Customize the welcome email message content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300">Welcome Heading</Label>
                <Input
                  value={template.headingText}
                  onChange={(e) => setTemplate({ ...template, headingText: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                  placeholder="Welcome aboard {{name}}"
                />
              </div>

              <div>
                <Label className="text-gray-300">
                  Default Intro Text
                  <span className="text-xs text-gray-500 ml-2">
                    (Used if AI personalization fails or is disabled)
                  </span>
                </Label>
                <Textarea
                  value={template.introText}
                  onChange={(e) => setTemplate({ ...template, introText: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white min-h-[80px]"
                  placeholder="Thanks for joining! You now have the tools to track markets..."
                />
              </div>

              <div>
                <Label className="text-gray-300">Feature List Label</Label>
                <Input
                  value={template.featureListLabel}
                  onChange={(e) => setTemplate({ ...template, featureListLabel: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                  placeholder="Here's what you can do right now:"
                />
              </div>

              <div>
                <Label className="text-gray-300">Feature Items</Label>
                <div className="space-y-2 mt-2">
                  {template.featureItems.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={item}
                        onChange={(e) => updateFeatureItem(index, e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeFeatureItem(index)}
                        className="border-red-600 text-red-400 hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newFeatureItem}
                      onChange={(e) => setNewFeatureItem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addFeatureItem()}
                      placeholder="Add new feature item..."
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addFeatureItem}
                      className="border-green-600 text-green-400 hover:bg-green-950"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Closing Text</Label>
                <Textarea
                  value={template.closingText}
                  onChange={(e) => setTemplate({ ...template, closingText: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white min-h-[80px]"
                  placeholder="We'll keep you informed with timely updates..."
                />
              </div>
            </CardContent>
          </Card>

          {/* CTA & Footer */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Button & Footer</CardTitle>
              <CardDescription className="text-gray-400">
                Configure the call-to-action button and footer content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Button Text</Label>
                  <Input
                    value={template.ctaButtonText}
                    onChange={(e) => setTemplate({ ...template, ctaButtonText: e.target.value })}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="Go to Dashboard"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Button URL</Label>
                  <Input
                    value={template.ctaButtonUrl}
                    onChange={(e) => setTemplate({ ...template, ctaButtonUrl: e.target.value })}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="{{baseUrl}}"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Footer Address</Label>
                <Input
                  value={template.footerAddress}
                  onChange={(e) => setTemplate({ ...template, footerAddress: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                  placeholder="{{companyAddress}}"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Website URL</Label>
                  <Input
                    value={template.footerLinks.websiteUrl}
                    onChange={(e) => setTemplate({
                      ...template,
                      footerLinks: { ...template.footerLinks, websiteUrl: e.target.value },
                    })}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="{{baseUrl}}"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Unsubscribe URL</Label>
                  <Input
                    value={template.footerLinks.unsubscribeUrl}
                    onChange={(e) => setTemplate({
                      ...template,
                      footerLinks: { ...template.footerLinks, unsubscribeUrl: e.target.value },
                    })}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="#"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Personalization Tab */}
        <TabsContent value="ai" className="space-y-6 mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                AI Personalization
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configure AI-powered personalization for welcome emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Enable AI Personalization</h4>
                  <p className="text-sm text-gray-400">
                    Use AI to generate personalized intro text based on user profile
                  </p>
                </div>
                <Switch
                  checked={template.useAIPersonalization}
                  onCheckedChange={(checked) => setTemplate({ ...template, useAIPersonalization: checked })}
                />
              </div>

              {template.useAIPersonalization && (
                <div>
                  <Label className="text-gray-300">AI Prompt</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    This prompt is sent to the AI model to generate personalized intro text.
                    Use <code className="text-yellow-400">{'{{userProfile}}'}</code> to include user data.
                  </p>
                  <Textarea
                    value={template.aiPersonalizationPrompt}
                    onChange={(e) => setTemplate({ ...template, aiPersonalizationPrompt: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white font-mono text-sm min-h-[200px]"
                    placeholder="Generate a personalized welcome message..."
                  />
                </div>
              )}

              {!template.useAIPersonalization && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-400">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    AI personalization is disabled. The default intro text will be used for all users.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6 mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Code className="h-5 w-5 text-cyan-400" />
                Custom HTML Template
              </CardTitle>
              <CardDescription className="text-gray-400">
                For advanced users: provide your own HTML template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Use Custom HTML</h4>
                  <p className="text-sm text-gray-400">
                    Replace the default template with your own HTML
                  </p>
                </div>
                <Switch
                  checked={template.useCustomHtml}
                  onCheckedChange={(checked) => setTemplate({ ...template, useCustomHtml: checked })}
                />
              </div>

              {template.useCustomHtml && (
                <div>
                  <Label className="text-gray-300">Custom HTML Template</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Available variables: <code className="text-yellow-400">{'{{name}}'}</code>,{' '}
                    <code className="text-yellow-400">{'{{intro}}'}</code>,{' '}
                    <code className="text-yellow-400">{'{{platformName}}'}</code>,{' '}
                    <code className="text-yellow-400">{'{{baseUrl}}'}</code>,{' '}
                    <code className="text-yellow-400">{'{{logoUrl}}'}</code>,{' '}
                    <code className="text-yellow-400">{'{{dashboardPreviewUrl}}'}</code>,{' '}
                    <code className="text-yellow-400">{'{{companyAddress}}'}</code>
                  </p>
                  <Textarea
                    value={template.customHtmlTemplate}
                    onChange={(e) => setTemplate({ ...template, customHtmlTemplate: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white font-mono text-sm min-h-[400px]"
                    placeholder="<!DOCTYPE html>..."
                  />
                </div>
              )}

              {!template.useCustomHtml && (
                <div className="p-4 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-400">
                    <Check className="h-4 w-4 inline mr-2 text-green-400" />
                    Using the built-in responsive email template. Toggle above to use custom HTML.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Template Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Email Template Active</h4>
                  <p className="text-sm text-gray-400">
                    When disabled, no welcome emails will be sent
                  </p>
                </div>
                <Switch
                  checked={template.isActive}
                  onCheckedChange={(checked) => setTemplate({ ...template, isActive: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

