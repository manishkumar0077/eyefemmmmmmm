import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Calendar, Clock, Info, MapPin, Phone, User, Mail, FileText, Check, X, CheckCircle, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast, toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import GynecologyLayout from "@/components/GynecologyLayout";
import { useManualHolidays } from "@/hooks/useManualHolidays";
import { GyneInsuranceProviders } from "@/components/GyneInsuranceProviders";
import { supabase } from "@/integrations/supabase/client";

interface Holiday {
  date: Date;
  reason: string;
  doctor: string | null;
}

const GynecologyAppointment = () => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    time: "",
    reason: "",
    additionalInfo: "",
    age: "",
    gender: ""
  });
  const [manualHolidays, setManualHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    const fetchManualHolidays = async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('date, name, doctor')
        .eq('type', 'manual');

      if (error) {
        console.error('Error fetching manual holidays:', error);
        return;
      }

      setManualHolidays((data || []).map(holiday => ({
        date: new Date(holiday.date),
        reason: holiday.name,
        doctor: holiday.doctor
      })));
    };

    fetchManualHolidays();
  }, []);

  const isManualHoliday = (date: Date) => {
    return manualHolidays.some(holiday =>
      holiday.date.getFullYear() === date.getFullYear() &&
      holiday.date.getMonth() === date.getMonth() &&
      holiday.date.getDate() === date.getDate() &&
      (holiday.doctor === null || holiday.doctor === 'all' || holiday.doctor === 'gynecology')
    );
  };

  const getHolidayReason = (date: Date) => {
    const holiday = manualHolidays.find(holiday =>
      holiday.date.getFullYear() === date.getFullYear() &&
      holiday.date.getMonth() === date.getMonth() &&
      holiday.date.getDate() === date.getDate() &&
      (holiday.doctor === null || holiday.doctor === 'all' || holiday.doctor === 'gynecology')
    );
    return holiday ? holiday.reason : "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate && isManualHoliday(selectedDate)) {
      const reason = getHolidayReason(selectedDate);
      const doctorSpecific = manualHolidays.find(h =>
        h.date.getFullYear() === selectedDate.getFullYear() &&
        h.date.getMonth() === selectedDate.getMonth() &&
        h.date.getDate() === selectedDate.getDate() &&
        h.doctor === 'gynecology'
      );

      toast({
        title: "Date Unavailable",
        description: doctorSpecific
          ? `Dr. Nisha Bhatnagar is unavailable on this date: ${reason}. Please select another date.`
          : `The clinic is closed on this date: ${reason}. Please select another date.`,
        variant: "destructive",
      });
      return;
    }
    setDate(selectedDate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      toast({
        title: "Please select a date",
        description: "A date is required to book an appointment",
        variant: "destructive",
      });
      return;
    }

    if (!formData.time) {
      toast({
        title: "Please select a time slot",
        description: "A time slot is required to book an appointment",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reason) {
      toast({
        title: "Please select a reason for visit",
        description: "A reason is required to book an appointment",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const formattedDate = format(date, "PPP");

      // Convert age to number
      const ageNumber = formData.age ? parseInt(formData.age) : null;

      // First, store appointment in database
      const { data: appointmentData, error: dbError } = await supabase
        .from('appointments')
        .insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          date: formattedDate,
          time: formData.time,
          reason: formData.reason,
          additional_info: formData.additionalInfo,
          specialty: "gynecology",
          clinic: "Eyefem Gynecology Clinic",
          doctor: "Nisha Bhatnagar",
          status: "pending",
          age: ageNumber,
          gender: formData.gender || null
        })
        .select();

      if (dbError) {
        throw new Error(dbError.message);
      }

      console.log("Appointment stored in database:", appointmentData);

      toast({
        title: "Processing your appointment",
        description: "Please wait while we prepare your confirmation...",
      });

      // Call the edge function to send notification emails
      const { data, error } = await supabase.functions.invoke("send-appointment", {
        body: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          date: formattedDate,
          time: formData.time,
          reason: formData.reason,
          additionalInfo: formData.additionalInfo,
          specialty: "gynecology",
          clinic: "Eyefem Gynecology Clinic",
          doctor: "Nisha Bhatnagar",
          age: ageNumber,
          gender: formData.gender || null
        }
      });

      if (error) {
        console.error("Error invoking edge function:", error);
        throw new Error("Failed to send email notifications: " + error.message);
      }

      console.log("Appointment submission response:", data);

      setFormSubmitted(true);
      toast({
        title: "Appointment Request Submitted",
        description: "We'll contact you shortly to confirm your appointment.",
        variant: "default",
      });

    } catch (error) {
      console.error("Error submitting appointment:", error);
      toast({
        title: "Error Submitting Appointment",
        description: "There was a problem submitting your appointment request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const { manualHolidays: manualHolidaysFromHook, holidayForDate, loading: holidayLoading } = useManualHolidays('gynecology');

  const isManualHolidayNew = (date: Date) => !!holidayForDate(date);
  const getHolidayReasonNew = (date: Date) => holidayForDate(date)?.reason || "";

  const selectedDateHolidayReason = date && isManualHolidayNew(date) ? getHolidayReasonNew(date) : "";

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://static.elfsight.com/platform/platform.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <GynecologyLayout>
      <section className="bg-gradient-to-r from-pink-500 to-pink-600 text-white py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-4xl mx-auto" data-aos="fade-up">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Book Your Appointment
            </h1>
            <p className="text-xl mb-8 text-white/90">
              Schedule a consultation with Dr. Nisha Bhatnagar and take the first
              step towards better health and fertility.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 min-h-screen flex items-center justify-center">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center">
            <div data-aos="fade-right" className="max-w-xl w-full">
              <h2 className="text-3xl font-bold mb-8 text-gynecology text-center">Contact Information</h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <MapPin className="h-6 w-6 text-gynecology shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-1">Aveya IVF Center</h3>
                    <p className="text-gray-600">
                      B-8, Vishal Enclave, Rajouri Garden<br />
                      New Delhi, Delhi 110008
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-eyecare shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold mb-1">Clinic EyeFem</h3>
                    <p className="text-gray-600 text-sm sm:text-base">
                      25/11, East Patel Nagar, New Delhi<br />
                      Delhi 110008
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Phone className="h-6 w-6 text-gynecology shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-1">Phone</h3>
                    <p className="text-gray-600">+91 98995 57022</p>
                    <p className="text-gray-600">+011 25815000</p>
                    <p className="text-gray-600">+011 25815001</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock className="h-6 w-6 text-gynecology shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-1">Working Hours</h3>
                    <p className="text-gray-600">Monday to Saturday: 10:00 AM - 6:00 PM <br/>at Ayeva IFV Centrer</p><br/>
                    <p className="text-gray-600">Available at clinic EyeFem on appointment basis</p>
                    <p className="text-gray-600">Sunday: Closed</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 md:mt-12">
                <div className="rounded-xl overflow-hidden h-[250px] sm:h-[300px] md:h-[350px] shadow-lg hover:shadow-xl transition-shadow border-2 border-gynecology/20 hover:border-gynecology/50">
                  <iframe 
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2913.1278202603517!2d77.11587957455815!3d28.653009483152122!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d033ff3c00021%3A0xc5281c1d1d03bc16!2sAveya%20IVF%20%26%20Fertility%20Center%20-%20Rajouri%20Garden%2C%20Delhi!5e0!3m2!1sen!2sus!4v1749888083099!5m2!1sen!2sus" 
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Aveya IVF & Fertility Center Location"
                    className="w-full h-full object-cover"
                  ></iframe>
                </div>
              </div>
            </div>

            <div data-aos="fade-left" className="mt-10 lg:mt-0">
              {/* {!formSubmitted ? (
                <>
                  <h2 className="text-3xl font-bold mb-8 text-[#d94991]">Request an Appointment</h2>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          required
                          placeholder="Enter your first name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          required
                          placeholder="Enter your last name"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          value={formData.age}
                          onChange={handleChange}
                          required
                          placeholder="Enter your age"
                          min="1"
                          max="120"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <Select onValueChange={(value) => handleSelectChange("gender", value)} required>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="Enter your email address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Preferred Date</Label>
                      {selectedDateHolidayReason && (
                        <div className="text-red-600 bg-red-50 px-3 py-2 mb-2 rounded font-medium flex items-center gap-2">
                          <span>Holiday: {selectedDateHolidayReason}</span>
                        </div>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            className="w-full border border-gray-300 rounded-md bg-white text-gray-800 px-4 py-2 justify-start text-left font-normal hover:bg-gray-50 flex items-center"
                            type="button"
                          >
                            <CalendarIcon className="mr-2 h-5 w-5 text-gray-400" />
                            {date ? format(date, "PPP") : <span className="text-gray-500">Select a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={date}
                            onSelect={handleDateSelect}
                            initialFocus
                            disabled={(d) =>
                              d < new Date() ||
                              d > new Date(new Date().setMonth(new Date().getMonth() + 3)) ||
                              isManualHolidayNew(d)
                            }
                            modifiers={{
                              holiday: manualHolidaysFromHook.map((h) => h.date),
                            }}
                            modifiersClassNames={{
                              holiday: "bg-red-100 text-red-800",
                            }}
                          />
                          <div className="mt-3">
                            {manualHolidaysFromHook.length > 0 && (
                              <div className="text-xs text-gray-600">
                                <b>Upcoming Holidays:</b>
                                <ul>
                                  {manualHolidaysFromHook
                                    .filter(
                                      (h) =>
                                        h.date >= new Date() &&
                                        h.doctor !== "other"
                                    )
                                    .sort((a, b) => +a.date - +b.date)
                                    .slice(0, 3)
                                    .map((h, idx) => (
                                      <li key={idx}>
                                        <span className="font-medium text-red-600">{format(h.date, "PPP")}</span>
                                        {": "}
                                        {h.reason}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Preferred Time</Label>
                      <Select onValueChange={(value) => handleSelectChange("time", value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a time slot" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</SelectItem>
                          <SelectItem value="Afternoon (12 PM - 3 PM)">Afternoon (12 PM - 3 PM)</SelectItem>
                          <SelectItem value="Evening (3 PM - 6 PM)">Evening (3 PM - 6 PM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Reason for Visit</Label>
                      <Select onValueChange={(value) => handleSelectChange("reason", value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General Gynecology Check-up">General Gynecology Check-up</SelectItem>
                          <SelectItem value="Fertility Consultation">Fertility Consultation</SelectItem>
                          <SelectItem value="Pregnancy Care">Pregnancy Care</SelectItem>
                          <SelectItem value="PCOS Management">PCOS Management</SelectItem>
                          <SelectItem value="Menopause Management">Menopause Management</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="additionalInfo">Additional Information</Label>
                      <Textarea
                        id="additionalInfo"
                        value={formData.additionalInfo}
                        onChange={handleChange}
                        placeholder="Please provide any additional details about your condition or requirements."
                        rows={4}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-[#d94991] hover:bg-[#d94991]/90 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Submitting..." : "Submit Appointment Request"}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 bg-[#d94991]/10 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="h-10 w-10 text-[#d94991]" />
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-[#d94991]">Thank You!</h2>
                  <p className="text-xl text-gray-600 mb-6">
                    Your appointment request has been successfully submitted. We've sent you a confirmation
                    email with the details. Our team will contact you shortly to confirm your appointment.
                  </p>

                  <Link to="/gynecology">
                    <Button className="bg-[#d94991] hover:bg-[#d94991]/90 text-white">
                      Return to Gynecology Home
                    </Button>
                  </Link>
                </div>
              )} */}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl text-center" data-aos="fade-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gynecology">
            Insurance Information
          </h2>
          
          <div className="mb-8">
            <GyneInsuranceProviders variant="gynecology" />
            <p className="text-sm text-gray-500 max-w-3xl mx-auto mt-4">
            Please Note: We accept most major insurance plans. To avoid any inconvenience, we kindly recommend contacting our office in advance to confirm your insurance coverage prior to your appointment. Please note that insurance is only applicable for surgical procedures and not for clinical visits or consultations.
            </p>
          </div>
        </div>
      </section>
    </GynecologyLayout>
  );
};

export default GynecologyAppointment;
