import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatCurrency } from '@/lib/utils';
import { Plus, Minus, Save, Loader2, WifiOff } from 'lucide-react';
import { useEnrollmentForm } from '@/hooks/useEnrollmentForm';

export function EnrollmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const {
    catalog, serviceLines, notes, setNotes, isLoading, isSaving, error,
    hasDraft, draftSavedAt, isEdit, subtotal,
    addService, updateQuantity, getServiceInfo, handleSave, saveDraftLocally,
  } = useEnrollmentForm(id);

  if (isLoading) return <LoadingSpinner className="h-64" text="Loading..." />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isEdit ? 'Edit Enrollment' : 'New Enrollment'}
        </h1>
        <p className="text-muted-foreground">Select services and submit your enrollment</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasDraft && draftSavedAt && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          Offline draft saved at {new Date(draftSavedAt).toLocaleTimeString()}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {catalog.map((svc) => {
                const inCart = serviceLines.find((sl) => sl.serviceId === svc.id);
                return (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">{svc.description}</p>
                      {svc.availableSeats !== null && (
                        <p className="text-xs text-muted-foreground">
                          {svc.availableSeats} seats available
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-semibold">{formatCurrency(svc.basePrice)}</span>
                      {inCart ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(svc.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {inCart.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(svc.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => addService(svc.id)}>
                          <Plus className="mr-1 h-3 w-3" />
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="notes" className="sr-only">Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Additional notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {serviceLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services selected</p>
              ) : (
                serviceLines.map((sl) => {
                  const svc = getServiceInfo(sl.serviceId);
                  if (!svc) return null;
                  return (
                    <div key={sl.serviceId} className="flex justify-between text-sm">
                      <span>
                        {svc.name} x{sl.quantity}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(svc.basePrice * sl.quantity)}
                      </span>
                    </div>
                  );
                })
              )}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button
              onClick={handleSave}
              className="w-full"
              disabled={serviceLines.length === 0 || isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Enrollment
            </Button>
            <Button
              variant="outline"
              onClick={saveDraftLocally}
              className="w-full"
              disabled={serviceLines.length === 0}
            >
              <WifiOff className="mr-2 h-4 w-4" />
              Save Draft Offline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
