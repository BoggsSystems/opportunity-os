import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
export declare class CompaniesController {
    private readonly companiesService;
    constructor(companiesService: CompaniesService);
    create(createCompanyDto: CreateCompanyDto, req: any): Promise<{
        name: string;
        id: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        linkedinUrl: string | null;
        domain: string | null;
        website: string | null;
        industry: string | null;
        sizeBand: string | null;
        geography: string | null;
        companyType: import("@opportunity-os/db").$Enums.CompanyType;
        description: string | null;
    }>;
    findAll(req: any): Promise<{
        name: string;
        id: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        linkedinUrl: string | null;
        domain: string | null;
        website: string | null;
        industry: string | null;
        sizeBand: string | null;
        geography: string | null;
        companyType: import("@opportunity-os/db").$Enums.CompanyType;
        description: string | null;
    }[]>;
    findOne(id: string, req: any): Promise<{
        name: string;
        id: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        linkedinUrl: string | null;
        domain: string | null;
        website: string | null;
        industry: string | null;
        sizeBand: string | null;
        geography: string | null;
        companyType: import("@opportunity-os/db").$Enums.CompanyType;
        description: string | null;
    }>;
    update(id: string, updateCompanyDto: UpdateCompanyDto, req: any): Promise<{
        name: string;
        id: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        linkedinUrl: string | null;
        domain: string | null;
        website: string | null;
        industry: string | null;
        sizeBand: string | null;
        geography: string | null;
        companyType: import("@opportunity-os/db").$Enums.CompanyType;
        description: string | null;
    }>;
    remove(id: string, req: any): Promise<void>;
}
//# sourceMappingURL=companies.controller.d.ts.map