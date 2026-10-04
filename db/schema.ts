import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const serviceRequests=sqliteTable('service_requests',{
 id:text('id').primaryKey(),type:text('type').notNull(),service:text('service').notNull(),name:text('name').notNull(),email:text('email').notNull(),phone:text('phone').notNull(),preferredDate:text('preferred_date').notNull(),preferredTime:text('preferred_time').notNull(),details:text('details').notNull(),status:text('status').notNull(),createdAt:text('created_at').notNull(),consentAt:text('consent_at').notNull()
},table=>[index('idx_service_requests_email_created').on(table.email,table.createdAt),index('idx_service_requests_status_date').on(table.status,table.preferredDate)]);
