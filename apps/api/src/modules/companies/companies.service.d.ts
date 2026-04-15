import { Company } from '@opportunity-os/db';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
export declare class CompaniesService {
    create(createCompanyDto: CreateCompanyDto, userId: string): Promise<Company>;
    findAll(userId: string): Promise<Company[]>;
    findOne(id: string, userId: string): Promise<Company>;
    update(id: string, updateCompanyDto: UpdateCompanyDto, userId: string): Promise<Company>;
    remove(id: string, userId: string): Promise<void>;
}
//# sourceMappingURL=companies.service.d.ts.map