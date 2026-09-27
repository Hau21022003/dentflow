import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';

/**
 * Search and pagination shared by the small, read-only appointment form
 * lookups. Sorting is intentionally fixed server-side so the client cannot
 * use this endpoint to enumerate staff or catalog data in arbitrary orders.
 */
export class ListAppointmentBookingOptionsQueryDto extends PageListQueryDto {}
