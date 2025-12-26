import { Schema, model, models, Document } from 'mongoose';

export interface IMarketHoliday {
  name: string;
  date: string; // YYYY-MM-DD format
  affectedAssets: ('forex' | 'crypto' | 'stocks' | 'indices' | 'commodities')[];
  isRecurring: boolean; // If true, repeats yearly
  createdAt?: Date;
}

export interface IDaySchedule {
  enabled: boolean;
  openTime: string;  // HH:MM format in UTC
  closeTime: string; // HH:MM format in UTC
}

export interface IAssetClassSchedule {
  enabled: boolean;
  monday: IDaySchedule;
  tuesday: IDaySchedule;
  wednesday: IDaySchedule;
  thursday: IDaySchedule;
  friday: IDaySchedule;
  saturday: IDaySchedule;
  sunday: IDaySchedule;
}

export interface IMarketSettings extends Document {
  // Mode: 'automatic' uses Massive.com API, 'manual' uses custom settings
  mode: 'automatic' | 'manual';
  
  // Automatic mode settings
  automaticSettings: {
    useMassiveAPI: boolean;
    cacheMinutes: number;
    fallbackToManual: boolean; // If API fails, use manual settings
  };
  
  // Manual schedules per asset class
  assetSchedules: {
    forex: IAssetClassSchedule;
    crypto: IAssetClassSchedule;
    stocks: IAssetClassSchedule;
    indices: IAssetClassSchedule;
    commodities: IAssetClassSchedule;
  };
  
  // Custom holidays
  holidays: IMarketHoliday[];
  
  // Global settings
  blockTradingOnHolidays: boolean;
  blockCompetitionsOnHolidays: boolean;
  blockChallengesOnHolidays: boolean;
  showHolidayWarning: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const DayScheduleSchema = new Schema({
  enabled: { type: Boolean, default: true },
  openTime: { type: String, default: '00:00' },
  closeTime: { type: String, default: '23:59' },
}, { _id: false });

const AssetClassScheduleSchema = new Schema({
  enabled: { type: Boolean, default: true },
  monday: { type: DayScheduleSchema, default: () => ({ enabled: true, openTime: '00:00', closeTime: '23:59' }) },
  tuesday: { type: DayScheduleSchema, default: () => ({ enabled: true, openTime: '00:00', closeTime: '23:59' }) },
  wednesday: { type: DayScheduleSchema, default: () => ({ enabled: true, openTime: '00:00', closeTime: '23:59' }) },
  thursday: { type: DayScheduleSchema, default: () => ({ enabled: true, openTime: '00:00', closeTime: '23:59' }) },
  friday: { type: DayScheduleSchema, default: () => ({ enabled: true, openTime: '00:00', closeTime: '22:00' }) },
  saturday: { type: DayScheduleSchema, default: () => ({ enabled: false, openTime: '00:00', closeTime: '00:00' }) },
  sunday: { type: DayScheduleSchema, default: () => ({ enabled: false, openTime: '00:00', closeTime: '00:00' }) },
}, { _id: false });

const MarketHolidaySchema = new Schema({
  name: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  affectedAssets: [{ 
    type: String, 
    enum: ['forex', 'crypto', 'stocks', 'indices', 'commodities'],
    default: ['forex']
  }],
  isRecurring: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const MarketSettingsSchema = new Schema<IMarketSettings>(
  {
    mode: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'automatic',
    },
    automaticSettings: {
      useMassiveAPI: { type: Boolean, default: true },
      cacheMinutes: { type: Number, default: 5 },
      fallbackToManual: { type: Boolean, default: true },
    },
    assetSchedules: {
      forex: { 
        type: AssetClassScheduleSchema, 
        default: () => ({
          enabled: true,
          monday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          tuesday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          wednesday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          thursday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          friday: { enabled: true, openTime: '00:00', closeTime: '22:00' },
          saturday: { enabled: false, openTime: '00:00', closeTime: '00:00' },
          sunday: { enabled: false, openTime: '00:00', closeTime: '00:00' },
        })
      },
      crypto: { 
        type: AssetClassScheduleSchema, 
        default: () => ({
          enabled: true,
          monday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          tuesday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          wednesday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          thursday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          friday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          saturday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
          sunday: { enabled: true, openTime: '00:00', closeTime: '23:59' },
        })
      },
      stocks: { type: AssetClassScheduleSchema, default: () => ({}) },
      indices: { type: AssetClassScheduleSchema, default: () => ({}) },
      commodities: { type: AssetClassScheduleSchema, default: () => ({}) },
    },
    holidays: [MarketHolidaySchema],
    blockTradingOnHolidays: { type: Boolean, default: true },
    blockCompetitionsOnHolidays: { type: Boolean, default: true },
    blockChallengesOnHolidays: { type: Boolean, default: true },
    showHolidayWarning: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Static method to get settings (singleton pattern)
MarketSettingsSchema.statics.getSettings = async function(): Promise<IMarketSettings> {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const MarketSettings = models?.MarketSettings || model<IMarketSettings>('MarketSettings', MarketSettingsSchema);

export default MarketSettings;

