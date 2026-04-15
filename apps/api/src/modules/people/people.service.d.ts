import { Person } from '@opportunity-os/db';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
export declare class PeopleService {
    create(createPersonDto: CreatePersonDto, userId: string): Promise<Person>;
    findAll(userId: string): Promise<Person[]>;
    findOne(id: string, userId: string): Promise<Person>;
    update(id: string, updatePersonDto: UpdatePersonDto, userId: string): Promise<Person>;
    remove(id: string, userId: string): Promise<void>;
}
//# sourceMappingURL=people.service.d.ts.map