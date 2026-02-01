import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Phone, 
  User, 
  Target, 
  Briefcase, 
  Utensils,
  MessageSquare,
  ArrowRight,
  Loader2,
  Leaf,
  Drumstick,
  Egg,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { consultationService } from '@/services';
import { useToast } from '@/hooks/use-toast';

// Extended types for the consultation form
type FitnessGoalExtended = 
  | 'weight_loss'
  | 'muscle_gain'
  | 'fat_loss_muscle_gain'
  | 'general_fitness'
  | 'medical_special'
  | 'not_sure';

type WorkRoutineExtended = 
  | 'student'
  | 'office_day'
  | 'office_night'
  | 'freelancer'
  | 'physically_active'
  | 'homemaker';

type FoodPreference = 'veg' | 'non_veg' | 'eggetarian';

// Form validation schema
const consultationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  fitnessGoal: z.enum([
    'weight_loss',
    'muscle_gain',
    'fat_loss_muscle_gain',
    'general_fitness',
    'medical_special',
    'not_sure'
  ], { required_error: 'Please select a fitness goal' }),
  workRoutine: z.enum([
    'student',
    'office_day',
    'office_night',
    'freelancer',
    'physically_active',
    'homemaker'
  ], { required_error: 'Please select your work routine' }),
  foodPreference: z.enum(['veg', 'non_veg', 'eggetarian'], { 
    required_error: 'Please select your food preference' 
  }),
  notes: z.string().optional(),
});

type ConsultationFormData = z.infer<typeof consultationSchema>;

const fitnessGoalOptions = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'fat_loss_muscle_gain', label: 'Fat Loss + Muscle Gain' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'medical_special', label: 'Medical / Special Diet' },
  { value: 'not_sure', label: 'Not Sure (Need Guidance)' },
];

const workRoutineOptions = [
  { value: 'student', label: 'Student' },
  { value: 'office_day', label: 'Office – Day Shift' },
  { value: 'office_night', label: 'Office – Night Shift' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'physically_active', label: 'Physically Active Job' },
  { value: 'homemaker', label: 'Homemaker' },
];

const foodPreferenceOptions = [
  { value: 'veg', label: 'Veg', icon: Leaf, color: 'text-green-600' },
  { value: 'non_veg', label: 'Non-Veg', icon: Drumstick, color: 'text-red-600' },
  { value: 'eggetarian', label: 'Eggetarian', icon: Egg, color: 'text-amber-600' },
];

const Consultation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
    mode: 'onChange',
  });

  const selectedGoal = watch('fitnessGoal');
  const selectedRoutine = watch('workRoutine');
  const selectedFood = watch('foodPreference');

  const onSubmit = async (data: ConsultationFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Map extended types to existing service types
      const goalMapping: Record<FitnessGoalExtended, 'weight_loss' | 'muscle_gain' | 'maintenance' | 'athletic_performance' | 'general_health'> = {
        weight_loss: 'weight_loss',
        muscle_gain: 'muscle_gain',
        fat_loss_muscle_gain: 'muscle_gain',
        general_fitness: 'general_health',
        medical_special: 'maintenance',
        not_sure: 'general_health',
      };

      const routineMapping: Record<WorkRoutineExtended, 'sedentary' | 'light_activity' | 'moderate_activity' | 'very_active' | 'extremely_active'> = {
        student: 'light_activity',
        office_day: 'sedentary',
        office_night: 'sedentary',
        freelancer: 'light_activity',
        physically_active: 'very_active',
        homemaker: 'moderate_activity',
      };

      await consultationService.submitConsultation({
        name: data.name,
        phone: `+91${data.phone}`,
        fitnessGoal: goalMapping[data.fitnessGoal],
        workRoutine: routineMapping[data.workRoutine],
        foodPreferences: data.foodPreference,
        additionalNotes: data.notes,
      });

      setIsSubmitted(true);
      toast({
        title: 'Request Submitted!',
        description: 'Our nutrition expert will contact you shortly.',
      });
    } catch (error) {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section with Banner */}
      <section 
        className="relative bg-oz-primary text-white py-12 md:py-16 overflow-hidden"
        style={{
          backgroundImage: 'url(/home/consultation-banner.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-oz-primary/70" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">
              Get a Free Nutrition Consultation
            </h1>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-0">
              Tell us about your goals. Our nutrition expert will guide you personally.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container max-w-xl mx-auto px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {isSubmitted ? (
            /* Success State */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-lg border-0">
                <CardContent className="pt-12 pb-8 px-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </motion.div>
                  
                  <h2 className="text-xl md:text-2xl font-bold text-primary mb-3">
                    Consultation Request Submitted!
                  </h2>
                  <p className="text-muted-foreground mb-8">
                    Our nutrition expert will contact you shortly on WhatsApp.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={() => navigate('/')}
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/5"
                    >
                      Back to Home
                    </Button>
                    <Button
                      onClick={() => navigate('/meal-packs')}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      Explore Meal Packs
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            /* Form State */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="shadow-lg border-0">
                <CardContent className="pt-6 pb-8 px-5 md:px-8">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                        <User className="w-4 h-4 text-secondary" />
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter your full name"
                        {...register('name')}
                        className={errors.name ? 'border-destructive' : ''}
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    {/* WhatsApp Number */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                        <Phone className="w-4 h-4 text-secondary" />
                        WhatsApp Number
                      </Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">
                          +91
                        </span>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="10-digit number"
                          maxLength={10}
                          {...register('phone')}
                          className={`rounded-l-none ${errors.phone ? 'border-destructive' : ''}`}
                        />
                      </div>
                      {errors.phone ? (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.phone.message}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          We'll contact you on WhatsApp
                        </p>
                      )}
                    </div>

                    {/* Primary Fitness Goal */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Target className="w-4 h-4 text-secondary" />
                        Primary Fitness Goal
                      </Label>
                      <Select
                        value={selectedGoal}
                        onValueChange={(value) => setValue('fitnessGoal', value as FitnessGoalExtended, { shouldValidate: true })}
                      >
                        <SelectTrigger className={errors.fitnessGoal ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select your goal" />
                        </SelectTrigger>
                        <SelectContent>
                          {fitnessGoalOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.fitnessGoal && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.fitnessGoal.message}
                        </p>
                      )}
                    </div>

                    {/* Work Routine */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Briefcase className="w-4 h-4 text-secondary" />
                        Work Routine
                      </Label>
                      <Select
                        value={selectedRoutine}
                        onValueChange={(value) => setValue('workRoutine', value as WorkRoutineExtended, { shouldValidate: true })}
                      >
                        <SelectTrigger className={errors.workRoutine ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select your routine" />
                        </SelectTrigger>
                        <SelectContent>
                          {workRoutineOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.workRoutine && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.workRoutine.message}
                        </p>
                      )}
                    </div>

                    {/* Food Preference */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Utensils className="w-4 h-4 text-secondary" />
                        Food Preference
                      </Label>
                      <RadioGroup
                        value={selectedFood}
                        onValueChange={(value) => setValue('foodPreference', value as FoodPreference, { shouldValidate: true })}
                        className="grid grid-cols-3 gap-3"
                      >
                        {foodPreferenceOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <Label
                              key={option.value}
                              htmlFor={option.value}
                              className={`
                                flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all
                                ${selectedFood === option.value 
                                  ? 'border-accent bg-accent/5' 
                                  : 'border-border hover:border-secondary/50'
                                }
                              `}
                            >
                              <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                              <Icon className={`w-5 h-5 ${option.color}`} />
                              <span className="text-xs font-medium">{option.label}</span>
                            </Label>
                          );
                        })}
                      </RadioGroup>
                      {errors.foodPreference && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.foodPreference.message}
                        </p>
                      )}
                    </div>

                    {/* Additional Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-medium">
                        <MessageSquare className="w-4 h-4 text-secondary" />
                        Additional Notes
                        <span className="text-muted-foreground font-normal">(Optional)</span>
                      </Label>
                      <Textarea
                        id="notes"
                        placeholder="Any allergies, health conditions, or questions?"
                        rows={3}
                        {...register('notes')}
                        className="resize-none"
                      />
                    </div>

                    {/* Error Message */}
                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
                      >
                        <p className="text-sm text-destructive flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {submitError}
                        </p>
                      </motion.div>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      size="lg"
                      disabled={!isValid || isSubmitting}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Request Free Consultation'
                      )}
                    </Button>

                    {/* Response Time Info */}
                    <p className="text-xs text-center text-muted-foreground">
                      Our team usually responds within 24 hours.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Consultation;
