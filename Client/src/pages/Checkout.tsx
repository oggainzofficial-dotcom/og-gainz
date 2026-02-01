// OG GAINZ - Checkout Page (Phase 4)
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, MapPin, Loader2, Building2, Home, CreditCard, Pencil, Trash2, LocateFixed } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { cartCheckoutService } from '@/services/cartCheckoutService';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Address } from '@/types';

declare global {
  interface Window {
    Razorpay?: new (opts: unknown) => { open: () => void };
  }
}

const addressSchema = z.object({
  label: z.string().min(1, 'Label is required').max(20, 'Label must be less than 20 characters'),
  username: z
    .string()
    .optional()
    .transform((v) => (typeof v === 'string' ? v.trim() : ''))
    .refine((v) => v === '' || v.length >= 2, 'Username must be at least 2 characters'),
  contactNumber: z
    .string()
    .transform((v) => String(v || '').replace(/\D/g, ''))
    .refine((v) => /^\d{10,15}$/.test(v), 'Contact number must be 10–15 digits'),
  housePlotNo: z.string().min(1, 'House / Plot No is required').max(50, 'Must be less than 50 characters'),
  street: z.string().min(2, 'Street is required').max(120, 'Must be less than 120 characters'),
  area: z.string().min(2, 'Area is required').max(120, 'Must be less than 120 characters'),
  district: z.string().min(2, 'District is required').max(80, 'Must be less than 80 characters'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  landmark: z.string().min(2, 'Landmark is required').max(100, 'Landmark must be less than 100 characters'),
  // Keep these for backend compatibility (defaults are fine for Bangalore)
  city: z.string().min(2, 'City is required').max(50, 'City must be less than 50 characters'),
  state: z.string().min(2, 'State is required').max(50, 'State must be less than 50 characters'),
  latitude: z
    .preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().finite().optional())
    .optional(),
  longitude: z
    .preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().finite().optional())
    .optional(),
  googleMapsLink: z
    .string()
    .optional()
    .transform((v) => (typeof v === 'string' ? v.trim() : ''))
    .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Enter a valid link (must start with http:// or https://)'),
});

type AddressFormData = z.infer<typeof addressSchema>;

const loadRazorpayScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector('script[data-razorpay="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpay = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
};

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading, updateProfile } = useUser();
  const { state, quote, isQuoting, quoteError, refreshQuote, setDeliveryLocation } = useCart();

  const addresses = user?.addresses || [];
  const defaultAddressId = addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || '';
  const [selectedAddressId, setSelectedAddressId] = useState<string>(defaultAddressId);
  const [showAddressForm, setShowAddressForm] = useState<boolean>(addresses.length === 0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [firstTimeLocationConfirm, setFirstTimeLocationConfirm] = useState<'yes' | 'no' | ''>('');

  const isFirstTimeSavingAddress = addresses.length === 0 && !editingAddressId;

  const extractLatLngFromGoogleMapsLink = (link: string): { latitude: number; longitude: number } | null => {
    const raw = (link || '').trim();
    if (!raw) return null;

    // Accept common Google Maps patterns:
    // - https://www.google.com/maps/@12.89245,80.204236,17z
    // - https://www.google.com/maps?q=12.89245,80.204236
    // - https://maps.google.com/?q=12.89245,80.204236
    const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      const latitude = Number(atMatch[1]);
      const longitude = Number(atMatch[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    }

    try {
      const url = new URL(raw);
      const q = url.searchParams.get('q') || url.searchParams.get('query');
      if (!q) return null;
      const qMatch = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
      if (!qMatch) return null;
      const latitude = Number(qMatch[1]);
      const longitude = Number(qMatch[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    } catch {
      return null;
    }
  };

  const coordsRoughlyMatch = (
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
    maxDelta = 0.0015 // ~150m-ish; avoids false mismatches without geocoding
  ) => {
    return Math.abs(from.latitude - to.latitude) <= maxDelta && Math.abs(from.longitude - to.longitude) <= maxDelta;
  };

  useEffect(() => {
    if (defaultAddressId && !selectedAddressId) setSelectedAddressId(defaultAddressId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAddressId]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!state.items.length) {
      navigate('/cart');
    }
  }, [state.items.length, navigate]);

  useEffect(() => {
    if (!state.items.length) return;

    const now = new Date();
    const cutoffHour = 19;
    const isAfterCutoff = now.getHours() >= cutoffHour;
    const minStartDate = (() => {
      const base = new Date(now);
      if (isAfterCutoff) base.setDate(base.getDate() + 1);
      const yyyy = base.getFullYear();
      const mm = String(base.getMonth() + 1).padStart(2, '0');
      const dd = String(base.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    })();

    const detailsById = state.orderDetailsByItemId || {};

    const missing = state.items.some((item) => {
      const d = detailsById[item.id];
      if (!d) return true;
      const plan = item.plan;
      const startDate = d.startDate;
      const deliveryTime = d.deliveryTime;
      const immediate = Boolean(d.immediateDelivery);

      if (plan === 'weekly' || plan === 'monthly') {
        if (!startDate || !deliveryTime) return true;
        if (startDate < minStartDate) return true;
        return false;
      }

      // single / trial
      if (immediate) {
        if (isAfterCutoff) return true;
        return false;
      }
      if (!startDate || !deliveryTime) return true;
      if (startDate < minStartDate) return true;
      return false;
    });

    if (missing) navigate('/order-details');
  }, [navigate, state.items, state.orderDetailsByItemId]);

  const selectedAddress = useMemo<Address | null>(() => {
    return addresses.find((a) => a.id === selectedAddressId) || null;
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!selectedAddress) return;
    if (typeof selectedAddress.latitude !== 'number' || typeof selectedAddress.longitude !== 'number') return;
    setDeliveryLocation({
      latitude: selectedAddress.latitude,
      longitude: selectedAddress.longitude,
      address: [selectedAddress.addressLine1, selectedAddress.city, selectedAddress.pincode].filter(Boolean).join(', '),
    });
  }, [selectedAddress, setDeliveryLocation]);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: '',
      username: '',
      contactNumber: '',
      housePlotNo: '',
      street: '',
      area: '',
      district: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      latitude: undefined,
      longitude: undefined,
      googleMapsLink: '',
    },
  });

  const handleGetCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast({
        title: 'Geolocation unavailable',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Fetching location…', description: 'Please allow location access in your browser.' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue('latitude', pos.coords.latitude, { shouldDirty: true, shouldValidate: true });
        form.setValue('longitude', pos.coords.longitude, { shouldDirty: true, shouldValidate: true });
        toast({ title: 'Location captured', description: 'Latitude/longitude added to this address.' });
      },
      (err) => {
        toast({
          title: 'Failed to get location',
          description: (err as { message?: string } | undefined)?.message || 'Please try again.',
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  };

  const openCreateAddress = () => {
    setEditingAddressId(null);
    setFirstTimeLocationConfirm(addresses.length === 0 ? '' : firstTimeLocationConfirm);
    form.reset({
      label: '',
      username: '',
      contactNumber: '',
      housePlotNo: '',
      street: '',
      area: '',
      district: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      latitude: undefined,
      longitude: undefined,
      googleMapsLink: '',
    });
    setShowAddressForm(true);
  };

  const openEditAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setFirstTimeLocationConfirm('');
    form.reset({
      label: address.label || '',
      username: address.username || '',
      contactNumber: address.contactNumber || '',
      housePlotNo: address.housePlotNo || '',
      street: address.street || '',
      area: address.area || '',
      district: address.district || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
      landmark: address.landmark || '',
      latitude: typeof address.latitude === 'number' ? address.latitude : undefined,
      longitude: typeof address.longitude === 'number' ? address.longitude : undefined,
      googleMapsLink: address.googleMapsLink || '',
    });
    setShowAddressForm(true);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user) return;
    const target = addresses.find((a) => a.id === addressId);
    if (!target) return;
    const ok = window.confirm(`Delete address “${target.label}”?`);
    if (!ok) return;

    const remaining = addresses.filter((a) => a.id !== addressId);
    if (remaining.length) {
      const hasDefault = remaining.some((a) => a.isDefault);
      if (!hasDefault) remaining[0] = { ...remaining[0], isDefault: true };
    }

    await updateProfile({ addresses: remaining });
    if (selectedAddressId === addressId) {
      setSelectedAddressId(remaining.find((a) => a.isDefault)?.id || remaining[0]?.id || '');
    }
    toast({ title: 'Address deleted' });
  };

  const handleAddressSubmit = async (data: AddressFormData) => {
    if (!user) return;

    // Phase 7D: require username + contact number for new addresses (do not break older saved addresses on edit)
    if (!editingAddressId) {
      const username = String(data.username || '').trim();
      if (username.length < 2) {
        form.setError('username', { type: 'manual', message: 'Username is required (min 2 characters)' });
        return;
      }
      if (!/^\d{10,15}$/.test(String(data.contactNumber || ''))) {
        form.setError('contactNumber', { type: 'manual', message: 'Contact number is required (10–15 digits)' });
        return;
      }
    }

    if (isFirstTimeSavingAddress && firstTimeLocationConfirm !== 'yes') {
      toast({
        title: 'Location required for first address',
        description:
          firstTimeLocationConfirm === 'no'
            ? 'For first time saving the location, you have to be in the point of delivery location to get the actual latitude and longitude.'
            : 'Please confirm you are currently at the delivery location.',
        variant: 'destructive',
      });
      return;
    }

    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      toast({
        title: 'Coordinates required',
        description: 'Tap “Get Current Location” so the system can save the correct latitude and longitude.',
        variant: 'destructive',
      });
      return;
    }

    if (data.googleMapsLink) {
      const extracted = extractLatLngFromGoogleMapsLink(data.googleMapsLink);
      if (!extracted) {
        toast({
          title: 'Could not read map coordinates',
          description: 'Paste a Google Maps link that contains coordinates (example: .../maps/@lat,lng or ?q=lat,lng).',
          variant: 'destructive',
        });
        return;
      }
      const captured = { latitude: data.latitude, longitude: data.longitude };
      if (!coordsRoughlyMatch(extracted, captured)) {
        toast({
          title: 'Location mismatch',
          description: 'Your Google Maps link does not match the detected current location. Re-capture location or paste the correct link.',
          variant: 'destructive',
        });
        return;
      }
    }

    const addressLine1 = [data.housePlotNo, data.street].filter(Boolean).join(', ');
    const addressLine2 = [data.area, data.district].filter(Boolean).join(', ') || undefined;

    const nextAddressBase: Address = {
      id: editingAddressId || `addr-${Date.now()}`,
      label: data.label,
      username: data.username || undefined,
      contactNumber: data.contactNumber,
      housePlotNo: data.housePlotNo,
      street: data.street,
      area: data.area,
      district: data.district,
      addressLine1,
      addressLine2,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      landmark: data.landmark,
      latitude: data.latitude,
      longitude: data.longitude,
      googleMapsLink: data.googleMapsLink || undefined,
      isDefault: false,
    };

    const nextAddresses: Address[] = editingAddressId
      ? addresses.map((a) => (a.id === editingAddressId ? { ...a, ...nextAddressBase } : a))
      : [
          { ...nextAddressBase, isDefault: true },
          ...addresses.map((a) => ({ ...a, isDefault: false })),
        ];

    try {
      await updateProfile({ addresses: nextAddresses });
      setShowAddressForm(false);
      const selectedId = editingAddressId || nextAddresses[0]?.id;
      if (selectedId) setSelectedAddressId(selectedId);
      setEditingAddressId(null);
      setFirstTimeLocationConfirm('');
      toast({ title: editingAddressId ? 'Address updated' : 'Address saved', description: 'Saved to your profile.' });
    } catch (err) {
      toast({
        title: 'Failed to save address',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const canPay = useMemo(() => {
    if (!quote) return false;
    if (isQuoting) return false;
    if (!quote.isServiceable) return false;
    if (!selectedAddress) return false;
    return true;
  }, [quote, isQuoting, selectedAddress]);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const handlePay = async () => {
    if (!quote) {
      toast({ title: 'Please wait', description: 'Quoting cart…', variant: 'destructive' });
      return;
    }
    if (!quote.isServiceable) {
      toast({ title: 'Not serviceable', description: 'Delivery location is outside service area.', variant: 'destructive' });
      return;
    }
    if (!selectedAddress) {
      toast({ title: 'Address required', description: 'Please select a delivery address.', variant: 'destructive' });
      return;
    }

    if (!selectedAddress.username) {
      toast({ title: 'Recipient required', description: 'Please add a recipient name to the selected address.', variant: 'destructive' });
      return;
    }

    if (!selectedAddress.contactNumber) {
      toast({ title: 'Contact required', description: 'Please add a contact number to the selected address.', variant: 'destructive' });
      return;
    }
    if (!selectedAddress.housePlotNo || !selectedAddress.street || !selectedAddress.area || !selectedAddress.district || !selectedAddress.landmark) {
      toast({
        title: 'Complete your address',
        description: 'House/Plot No, Street, Area, District, and Landmark are required.',
        variant: 'destructive',
      });
      return;
    }
    if (typeof selectedAddress.latitude !== 'number' || typeof selectedAddress.longitude !== 'number') {
      toast({
        title: 'Coordinates required',
        description: 'Use “Get Current Location” when adding the address so the server can compute delivery distance + fee.',
        variant: 'destructive',
      });
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);
    try {
      // Ensure we have the latest quote before initiating payment.
      await refreshQuote();

      const initiate = await cartCheckoutService.initiateCheckout(state, {
        deliveryAddress: {
          label: selectedAddress.label,
          username: selectedAddress.username,
          contactNumber: selectedAddress.contactNumber,
          housePlotNo: selectedAddress.housePlotNo,
          street: selectedAddress.street,
          area: selectedAddress.area,
          district: selectedAddress.district,
          addressLine1: selectedAddress.addressLine1,
          addressLine2: selectedAddress.addressLine2,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          landmark: selectedAddress.landmark,
          latitude: selectedAddress.latitude,
          longitude: selectedAddress.longitude,
        },
      });

      setActiveOrderId(initiate.order.id);

      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error('Razorpay failed to load');

      const opts = {
        key: initiate.keyId,
        amount: initiate.razorpayOrder.amount,
        currency: initiate.razorpayOrder.currency,
        name: 'OG Gainz',
        description: `Order ${initiate.order.id}`,
        order_id: initiate.razorpayOrder.id,
        notes: {
          appOrderId: initiate.order.id,
        },
        prefill: {
          email: user?.email,
          name: user?.name,
        },
        theme: { color: '#16A34A' },
        handler: () => {
          // Phase 5B: never assume paid. Navigate to verification flow.
          toast({
            title: 'Payment submitted',
            description: 'Verifying payment status…',
          });
          navigate(`/order/success/${initiate.order.id}`);
        },
        modal: {
          ondismiss: () => {
            toast({
              title: 'Payment cancelled',
              description: `Order ${initiate.order.id} is pending payment.`,
              variant: 'destructive',
            });
            navigate(`/order/failed/${initiate.order.id}`);
          },
        },
      };

      const rz = new window.Razorpay(opts);
      rz.open();
    } catch (err) {
      toast({
        title: 'Checkout failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="bg-oz-neutral/30 border-b border-oz-neutral">
        <div className="container mx-auto px-4 py-4">
          <Link
            to="/order-details"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-oz-primary transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Order Details
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-oz-primary mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-oz-secondary" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {addresses.length > 0 && !showAddressForm ? (
                  <div className="space-y-4">
                    <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId}>
                      {addresses.map((address) => (
                        <div
                          key={address.id}
                          className={`flex items-start gap-3 p-4 rounded-2xl border bg-white shadow-sm transition-colors ${
                            selectedAddressId === address.id
                              ? 'border-oz-secondary bg-oz-secondary/5'
                              : 'border-border hover:border-oz-secondary/50'
                          }`}
                        >
                          <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                          <label htmlFor={address.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2 mb-1">
                              {address.label.toLowerCase() === 'home' ? (
                                <Home className="h-4 w-4 text-oz-secondary" />
                              ) : (
                                <Building2 className="h-4 w-4 text-oz-secondary" />
                              )}
                              <span className="font-medium text-oz-primary">{address.label}</span>
                              {address.isDefault && (
                                <span className="text-xs bg-oz-accent/10 text-oz-accent px-2 py-0.5 rounded">Default</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {address.addressLine1}
                              {address.addressLine2 && `, ${address.addressLine2}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                            {address.contactNumber ? (
                              <p className="text-xs text-muted-foreground mt-1">Contact: {address.contactNumber}</p>
                            ) : (
                              <p className="text-xs text-destructive mt-1">Missing contact number (required)</p>
                            )}
                            {(!address.housePlotNo || !address.street || !address.area || !address.district || !address.landmark) ? (
                              <p className="text-xs text-destructive mt-1">Address details incomplete (required)</p>
                            ) : null}
                            {(typeof address.latitude !== 'number' || typeof address.longitude !== 'number') && (
                              <p className="text-xs text-destructive mt-2">Missing latitude/longitude (required for delivery quote)</p>
                            )}
                          </label>

                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditAddress(address)}
                              className="rounded-xl"
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDeleteAddress(address.id)}
                              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>

                    <Button variant="outline" onClick={openCreateAddress} className="w-full rounded-2xl">
                      + Add New Address
                    </Button>
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAddressSubmit)} className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
                      <input type="hidden" {...form.register('latitude')} />
                      <input type="hidden" {...form.register('longitude')} />

                      {isFirstTimeSavingAddress ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="font-semibold text-amber-900">First time saving this location</div>
                          <div className="mt-1 text-sm text-amber-800">
                            We must capture your real delivery coordinates. Please confirm you are currently at the delivery point.
                          </div>
                          <div className="mt-3">
                            <RadioGroup
                              value={firstTimeLocationConfirm}
                              onValueChange={(v) => {
                                const next = v === 'yes' || v === 'no' ? v : '';
                                setFirstTimeLocationConfirm(next);
                                if (next === 'yes') handleGetCurrentLocation();
                              }}
                              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                            >
                              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
                                <RadioGroupItem value="yes" id="firstLocYes" />
                                <label htmlFor="firstLocYes" className="text-sm text-oz-primary cursor-pointer">
                                  Yes, I am at the delivery location
                                </label>
                              </div>
                              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
                                <RadioGroupItem value="no" id="firstLocNo" />
                                <label htmlFor="firstLocNo" className="text-sm text-oz-primary cursor-pointer">
                                  No
                                </label>
                              </div>
                            </RadioGroup>
                          </div>
                          {firstTimeLocationConfirm === 'no' ? (
                            <div className="mt-3 text-sm text-amber-900">
                              For first time saving the location, you have to be in the point of delivery location to get the actual
                              latitude and longitude.
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-oz-primary">Contact Details</div>
                          {editingAddressId && (!form.getValues('username') || !form.getValues('contactNumber')) ? (
                            <div className="mt-1 text-xs text-amber-700">Please add username/contact number to complete this address.</div>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Recipient Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Full name" autoComplete="name" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">Required for new addresses (min 2 characters).</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="contactNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contact Number</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="10–15 digit phone number"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    value={field.value}
                                    maxLength={15}
                                    onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">Digits only. Used by delivery team to reach you.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="label"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Label</FormLabel>
                                <FormControl>
                                  <Input placeholder="Home" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">Shown in your saved addresses list.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-oz-primary">Address Details</div>
                          <div className="mt-1 text-xs text-muted-foreground">Add clear directions so delivery is smooth.</div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="housePlotNo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>House / Plot No</FormLabel>
                                  <FormControl>
                                    <Input placeholder="12B" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="street"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Street</FormLabel>
                                  <FormControl>
                                    <Input placeholder="MG Road" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="area"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Area</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Indiranagar" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="district"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>District</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Bengaluru Urban" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="pincode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Pincode</FormLabel>
                                  <FormControl>
                                    <Input placeholder="560001" maxLength={6} {...field} />
                                  </FormControl>
                                  <FormDescription className="text-xs">6 digits.</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="landmark"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Landmark</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Near Metro Station" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Bangalore" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Karnataka" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-oz-primary">Delivery Location</div>
                          <div className="mt-1 text-xs text-muted-foreground">Required to calculate delivery fee accurately.</div>
                        </div>

                        <div className="space-y-4">
                          <Button type="button" variant="outline" onClick={handleGetCurrentLocation} className="w-full">
                            <LocateFixed className="mr-2 h-4 w-4" />
                            Get Current Location
                          </Button>

                          {typeof form.watch('latitude') === 'number' && typeof form.watch('longitude') === 'number' ? (
                            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                              Saved location: {form.watch('latitude').toFixed(6)}, {form.watch('longitude').toFixed(6)}
                            </div>
                          ) : (
                            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                              Location is required for delivery fee calculation.
                            </div>
                          )}

                          <FormField
                            control={form.control}
                            name="googleMapsLink"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Google Maps Link (recommended)</FormLabel>
                                <FormControl>
                                  <Input placeholder="https://www.google.com/maps/@12.89245,80.204236,17z" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Paste your delivery point link. We’ll validate it against the detected coordinates.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                        {addresses.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowAddressForm(false);
                              setEditingAddressId(null);
                              setFirstTimeLocationConfirm('');
                            }}
                          >
                            Cancel
                          </Button>
                        ) : null}
                        <Button type="submit" className="bg-oz-secondary hover:bg-oz-secondary/90">
                          Save Address
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-oz-secondary" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Razorpay order is created on the server. Phase 4 does not include webhook verification.
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="border-oz-secondary">
                <CardHeader className="bg-oz-secondary/5">
                  <CardTitle className="text-oz-primary">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {quoteError ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-oz-primary">
                      {quoteError}
                    </div>
                  ) : null}

                  <div className="space-y-3 mb-4">
                    {quote?.items?.map((item) => (
                      <div key={item.cartItemId} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.title} × {item.quantity}</span>
                        <span>{formatCurrency(item.lineTotal)}</span>
                      </div>
                    )) || (
                      <div className="text-sm text-muted-foreground">Quoting…</div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(quote?.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>{(quote?.deliveryFee || 0) === 0 ? 'Free' : formatCurrency(quote?.deliveryFee || 0)}</span>
                    </div>
                    {(quote?.creditsApplied || 0) > 0 ? (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Wallet Credits</span>
                        <span>-{formatCurrency(quote?.creditsApplied || 0)}</span>
                      </div>
                    ) : null}
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span className="text-oz-primary">Total</span>
                      <span>{formatCurrency(quote?.total || 0)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handlePay}
                    disabled={!canPay || isProcessing}
                    className="w-full mt-6 bg-oz-accent hover:bg-oz-accent/90 h-12 text-lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      `Pay ${formatCurrency(quote?.total || 0)}`
                    )}
                  </Button>
                  <p className="mt-4 text-xs text-center text-muted-foreground">
                    Totals and delivery are computed server-side.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
