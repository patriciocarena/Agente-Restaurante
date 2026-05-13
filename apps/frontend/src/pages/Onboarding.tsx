// apps/frontend/src/pages/Onboarding.tsx
// Wizard orchestrator: 4-step onboarding wizard with FormProvider.
// Uses useOnboardingResume for resume logic and useRestaurantSetup for mutations.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  onboardingSchema,
  OnboardingData,
  STEP_FIELDS,
  DEFAULT_HOURS,
} from '@/lib/onboarding-schema';
import { ApiError } from '@/lib/api';
import { useOnboardingResume } from '@/hooks/useOnboardingResume';
import { useRestaurantSetup } from '@/hooks/useRestaurantSetup';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/onboarding/Stepper';
import { StepOneData } from '@/components/onboarding/StepOneData';
import { StepTwoHours } from '@/components/onboarding/StepTwoHours';
import { StepThreeDelivery } from '@/components/onboarding/StepThreeDelivery';
import { StepFourVoice } from '@/components/onboarding/StepFourVoice';
import { TwilioErrorScreen } from '@/components/onboarding/TwilioErrorScreen';

export default function Onboarding() {
  const resume = useOnboardingResume();
  const setup = useRestaurantSetup();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [twilioFail, setTwilioFail] = useState<{ count: number } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const methods = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      slug: '',
      address: '',
      agent_name: 'Sofía',
      delivery_zones: '',
      hours: DEFAULT_HOURS,
    },
  });

  // Gate: check resume state and redirect if already completed
  useEffect(() => {
    if (resume && 'initialStep' in resume) {
      if (resume.initialStep >= 4) {
        navigate('/dashboard', { replace: true });
      } else {
        setStep(resume.initialStep);
      }
    }
  }, [resume, navigate]);

  // Update browser title
  useEffect(() => {
    document.title = 'Configurá tu restaurante';
  }, []);

  const handleNext = async () => {
    const valid = await methods.trigger(STEP_FIELDS[step]);
    if (!valid) return;

    const data = methods.getValues();

    try {
      if (step === 0) {
        // Step 1: create or patch restaurant
        if (resume && 'hasRestaurant' in resume && resume.hasRestaurant) {
          await setup.patchMe({
            name: data.name,
            address: data.address,
            onboarding_step: 1,
          });
        } else {
          const created = await setup.createRestaurant({
            name: data.name,
            address: data.address,
          });
          if (!created) return; // error already set in setup.error
        }
      } else if (step === 1) {
        // Step 2: save hours and advance
        await setup.putHours(data.hours);
        await setup.patchMe({ onboarding_step: 2 });
      } else if (step === 2) {
        // Step 3: save delivery zones and advance
        await setup.patchMe({
          delivery_zones: data.delivery_zones ?? '',
          onboarding_step: 3,
        });
      }

      setStep((s) => s + 1);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slug_taken') {
        methods.setError('slug', {
          message: 'Ese identificador ya está tomado. Probá con otro.',
        });
      }
    }
  };

  const handleFinish = async () => {
    const valid = await methods.trigger(['agent_name']);
    if (!valid) return;

    const data = methods.getValues();
    setIsFinishing(true);

    try {
      await setup.patchMe({
        agent_name: data.agent_name,
        onboarding_step: 4,
      });
      await setup.finishOnboarding();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setTwilioFail({ count: 0 });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleTwilioRetry = async () => {
    setIsFinishing(true);
    try {
      await setup.retryProvision();
      navigate('/dashboard', { replace: true });
    } catch {
      setTwilioFail((prev) => prev ? { count: prev.count + 1 } : { count: 1 });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Loading skeleton
  if (resume === undefined) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
          <span className="text-sm font-semibold">Agente Restaurante</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Salir
          </Button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
        <span className="text-sm font-semibold">Agente Restaurante</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Salir
        </Button>
      </header>

      {/* Stepper */}
      {!twilioFail && <Stepper current={step} />}

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">
          <FormProvider {...methods}>
            {twilioFail ? (
              <TwilioErrorScreen
                retryCount={twilioFail.count}
                onRetry={handleTwilioRetry}
                isRetrying={isFinishing}
              />
            ) : step === 0 ? (
              <StepOneData />
            ) : step === 1 ? (
              <StepTwoHours />
            ) : step === 2 ? (
              <StepThreeDelivery />
            ) : step === 3 ? (
              <StepFourVoice
                onFinish={handleFinish}
                isLoading={isFinishing}
              />
            ) : null}
          </FormProvider>

          {/* Nav buttons (hide during Twilio error) */}
          {!twilioFail && step < 3 && (
            <div className="flex gap-3 mt-8">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Atrás
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleNext}
                disabled={setup.loading}
              >
                Siguiente
              </Button>
            </div>
          )}

          {/* Error display */}
          {setup.error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-md text-sm">
              Error: {setup.error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
