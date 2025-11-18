import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import QRCodeSVG from 'react-qr-code';
import { useInventoryQRCode } from '@/hooks/useInventoryQRCode';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InventoryQRCodeCardProps {
  profile: any;
}

export function InventoryQRCodeCard({ profile }: InventoryQRCodeCardProps) {
  const {
    qrData,
    isExpired,
    isGenerating,
    formatTimeRemaining,
    timeRemaining,
    generateQRCode
  } = useInventoryQRCode(profile);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <CardTitle>Inventory Room Access</CardTitle>
          </div>
          {!isExpired && (
            <Badge variant="default" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeRemaining()}
            </Badge>
          )}
        </div>
        <CardDescription>
          Generate a QR code to access the inventory room. Valid for 30 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Show this QR code at the inventory room scanner. The code expires after 30 minutes for security.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col items-center gap-4">
            {qrData && !isExpired ? (
              <>
                <div className="bg-card p-4 rounded-lg border-2 border-primary">
                  <QRCodeSVG
                    value={qrData}
                    size={256}
                    level="H"
                  />
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {profile.full_name} ({profile.employee_id})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile.department?.name || 'N/A'}
                  </p>
                  <div className="flex items-center gap-2 justify-center">
                    <div className={`h-2 w-2 rounded-full ${
                      timeRemaining > 600000 ? 'bg-green-500' : 
                      timeRemaining > 300000 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">
                      Valid for {formatTimeRemaining()}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={generateQRCode}
                  variant="outline"
                  disabled={isGenerating}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate QR Code
                </Button>
              </>
            ) : (
              <div className="text-center space-y-4 py-8">
                <div className="mx-auto w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                  <QrCode className="h-16 w-16 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isExpired && qrData ? 'Your QR code has expired' : 'No active QR code'}
                  </p>
                  <Button
                    onClick={generateQRCode}
                    disabled={isGenerating}
                    className="w-full sm:w-auto"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate QR Code
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
