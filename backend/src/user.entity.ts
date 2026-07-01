import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

// @Entity() signale que cette classe n'est pas du code classique, 
// mais la représentation exacte d'une table dans ta base SQLite.
@Entity()
export class User {
    // @PrimaryGeneratedColumn() crée un ID unique qui s'auto-incrémente (1, 2, 3...)
    @PrimaryGeneratedColumn()
    id: number;

    // @Column() crée une colonne classique dans la table
    @Column()
    username: string;

    @Column()
    email: string;

    @Column()
    password: string;

    // Ici, on ajoute une règle : si on ne précise pas le rôle lors de l'inscription,
    // la base de données lui donnera automatiquement le rôle 'INVITE' pour des raisons de sécurité.
    @Column({ default: 'INVITE' })
    role: string;
}