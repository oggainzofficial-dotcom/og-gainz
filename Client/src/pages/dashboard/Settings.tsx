// OG GAINZ - User Settings
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Home, 
  Building2, 
  Plus,
  Trash2,
  Edit2,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import type { Address } from "@/types";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid phone number"),
});

const addressSchema = z.object({
  username: z
    .string()
    .optional()
    .transform((v) => (typeof v === 'string' ? v.trim() : ''))
    .refine((v) => v === '' || v.length >= 2, 'Username must be at least 2 characters'),
  contactNumber: z
    .string()
    .optional()
    .transform((v) => String(v || '').replace(/\D/g, ''))
    .refine((v) => v === '' || /^\d{10,15}$/.test(v), 'Contact number must be 10–15 digits'),
  label: z.string().min(1, "Label is required").max(20),
  addressLine1: z.string().min(5, "Address is required").max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2, "City is required").max(50),
  state: z.string().min(2, "State is required").max(50),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  landmark: z.string().max(100).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type AddressFormData = z.infer<typeof addressSchema>;

const Settings = () => {
  const { user, updateProfile } = useUser();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
    },
  });

  const addressForm = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      username: "",
      contactNumber: "",
      label: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    updateProfile({ name: data.name, phone: data.phone });
    setIsEditing(false);
    toast({
      title: "Profile Updated",
      description: "Your profile has been updated successfully.",
    });
  };

  const handleAddressSubmit = (data: AddressFormData) => {
    // Phase 7D: require username + contact number for new addresses (do not break older saved addresses on edit)
    if (!editingAddress) {
      const username = String(data.username || '').trim();
      const phone = String(data.contactNumber || '');
      if (username.length < 2) {
        addressForm.setError('username', { type: 'manual', message: 'Username is required (min 2 characters)' });
        return;
      }
      if (!/^\d{10,15}$/.test(phone)) {
        addressForm.setError('contactNumber', { type: 'manual', message: 'Contact number is required (10–15 digits)' });
        return;
      }
    }

    const newAddress: Address = {
      id: editingAddress?.id || `addr-${Date.now()}`,
      username: data.username || undefined,
      contactNumber: data.contactNumber || undefined,
      label: data.label,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      landmark: data.landmark,
      isDefault: editingAddress?.isDefault || user?.addresses.length === 0 || false,
    };

    const updatedAddresses = editingAddress
      ? user?.addresses.map((a) => (a.id === editingAddress.id ? newAddress : a)) || []
      : [...(user?.addresses || []), newAddress];

    updateProfile({ addresses: updatedAddresses });
    setShowAddressDialog(false);
    setEditingAddress(null);
    addressForm.reset();

    toast({
      title: editingAddress ? "Address Updated" : "Address Added",
      description: `Your address has been ${editingAddress ? "updated" : "added"} successfully.`,
    });
  };

  const handleDeleteAddress = (addressId: string) => {
    const updatedAddresses = user?.addresses.filter((a) => a.id !== addressId) || [];
    updateProfile({ addresses: updatedAddresses });
    toast({
      title: "Address Deleted",
      description: "The address has been removed.",
    });
  };

  const handleSetDefault = (addressId: string) => {
    const updatedAddresses = user?.addresses.map((a) => ({
      ...a,
      isDefault: a.id === addressId,
    })) || [];
    updateProfile({ addresses: updatedAddresses });
    toast({
      title: "Default Address Updated",
      description: "Your default delivery address has been updated.",
    });
  };

  const openEditAddress = (address: Address) => {
    setEditingAddress(address);
    addressForm.reset({
      username: address.username || "",
      contactNumber: address.contactNumber || "",
      label: address.label,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark || "",
    });
    setShowAddressDialog(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-oz-secondary" />
            Profile Information
          </CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-oz-secondary hover:bg-oz-secondary/90">
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-oz-secondary flex items-center justify-center text-white text-2xl font-bold">
                  {user?.name?.charAt(0) || "U"}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{user?.name || "User"}</h3>
                  {user?.isVerified && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{user?.phone}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Addresses Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-oz-secondary" />
            Delivery Addresses
          </CardTitle>
          <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  setEditingAddress(null);
                  addressForm.reset();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl sm:rounded-2xl animate-in fade-in-0 zoom-in-95 duration-200">
              <DialogHeader>
                <DialogTitle>{editingAddress ? "Edit Address" : "Add New Address"}</DialogTitle>
              </DialogHeader>
              <Form {...addressForm}>
                <form onSubmit={addressForm.handleSubmit(handleAddressSubmit)} className="space-y-5">
                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <div className="text-sm font-semibold text-oz-primary">Contact Details</div>
                      {editingAddress && (!addressForm.getValues('username') || !addressForm.getValues('contactNumber')) ? (
                        <div className="mt-1 text-xs text-amber-700">Please add username/contact number to complete this address.</div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={addressForm.control}
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
                        control={addressForm.control}
                        name="contactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="10–15 digit phone number"
                                inputMode="tel"
                                autoComplete="tel"
                                value={field.value || ''}
                                maxLength={15}
                                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">Digits only. Used by delivery team to reach you.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-oz-primary">Address Details</div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={addressForm.control}
                        name="label"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Label</FormLabel>
                            <FormControl>
                              <Input placeholder="Home, Office" {...field} />
                            </FormControl>
                            <FormDescription className="text-xs">Shown in your saved addresses list.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addressForm.control}
                        name="pincode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pincode</FormLabel>
                            <FormControl>
                              <Input placeholder="560001" maxLength={6} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={addressForm.control}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Textarea placeholder="House/Flat No., Building, Street" className="resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addressForm.control}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Area, Locality" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={addressForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addressForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={addressForm.control}
                      name="landmark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Landmark (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Near Metro Station" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowAddressDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-oz-secondary hover:bg-oz-secondary/90">
                      {editingAddress ? "Update Address" : "Save Address"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!user?.addresses || user.addresses.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No addresses saved yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {user.addresses.map((address) => (
                <div key={address.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {address.label.toLowerCase() === "home" ? (
                        <Home className="h-5 w-5 text-oz-secondary mt-0.5" />
                      ) : (
                        <Building2 className="h-5 w-5 text-oz-secondary mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{address.label}</span>
                          {address.isDefault && (
                            <Badge variant="outline" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {address.addressLine1}
                          {address.addressLine2 && `, ${address.addressLine2}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {address.city}, {address.state} - {address.pincode}
                        </p>
                        {address.landmark && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Landmark: {address.landmark}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!address.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(address.id)}
                          className="text-muted-foreground"
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditAddress(address)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAddress(address.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
